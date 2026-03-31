/**
 * GetTrainMate AppSync GraphQL resolver (Lambda).
 * Reads/writes same DynamoDB tables as .NET API (gettrainmate-*).
 * Identity: Cognito JWT -> event.identity.sub (userId).
 */

const {
  DynamoDBClient,
  GetItemCommand,
  PutItemCommand,
  DeleteItemCommand,
  UpdateItemCommand,
  QueryCommand,
  ScanCommand,
  ConditionCheck,
  TransactWriteCommand,
} = require('@aws-sdk/client-dynamodb');
const { marshall, unmarshall } = require('@aws-sdk/util-dynamodb');
const { CognitoIdentityProviderClient, AdminGetUserCommand } = require('@aws-sdk/client-cognito-identity-provider');
const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

const PREFIX = process.env.DYNAMODB_TABLE_PREFIX || 'gettrainmate-';
const USER_POOL_ID = process.env.COGNITO_USER_POOL_ID || '';
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '').split(',').map((e) => e.trim()).filter(Boolean);
const MEDIA_BUCKET = process.env.MEDIA_BUCKET_NAME || 'getrainmate-media-bucket';
const AWS_REGION = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'us-east-1';
// Demo profile photos: distinct person portraits so each profile shows a different face (women for female profiles, men for male)
const RANDOMUSER = 'https://randomuser.me/api/portraits';
const DEMO_PERSON_PHOTOS = [
  `${RANDOMUSER}/women/1.jpg`,   // Sarah Runner
  `${RANDOMUSER}/men/2.jpg`,    // Mike Cyclist
  `${RANDOMUSER}/women/3.jpg`,  // Emma Yoga
  `${RANDOMUSER}/men/4.jpg`,    // Alex Hyrox
  `${RANDOMUSER}/men/5.jpg`,    // Jordan Pickleball
  `${RANDOMUSER}/women/10.jpg`, // Maya
  `${RANDOMUSER}/women/11.jpg`, // Jess
  `${RANDOMUSER}/women/12.jpg`, // Riley
];

async function toAvatarUrl(photoUrls, photoKey, userIdForPlaceholder) {
  if (photoUrls && photoUrls[0] && (photoUrls[0].startsWith('http://') || photoUrls[0].startsWith('https://'))) return photoUrls[0];
  if (photoKey) {
    const s3 = new S3Client({ region: AWS_REGION });
    const key = photoKey.replace(/^\//, '');
    return getSignedUrl(s3, new GetObjectCommand({ Bucket: MEDIA_BUCKET, Key: key }), { expiresIn: 3600 });
  }
  if (userIdForPlaceholder) {
    const n = String(userIdForPlaceholder).split('').reduce((a, b) => a + b.charCodeAt(0), 0);
    const idx = (n % 99) + 1;
    const gender = n % 2 === 0 ? 'women' : 'men';
    return `https://randomuser.me/api/portraits/${gender}/${idx}.jpg`;
  }
  return null;
}

const dynamo = new DynamoDBClient({});
const cognito = new CognitoIdentityProviderClient({});

const tables = {
  profiles: `${PREFIX}profiles`,
  matches: `${PREFIX}matches`,
  discoverPasses: `${PREFIX}discover-passes`,
  chatThreads: `${PREFIX}chat-threads`,
  messages: `${PREFIX}messages`,
  userCredits: `${PREFIX}user-credits`,
  creditTransactions: `${PREFIX}credit-transactions`,
};

const FREE_START_CREDITS = 3;
const FREE_START_REASON = 'FREE_START';
const CREDIT_REASON_LIKE = 'LIKE';
const CREDIT_REASON_CHAT_UNLOCK = 'CHAT_UNLOCK';

function getUserId(identity) {
  if (!identity || !identity.sub) throw new Error('UNAUTHORIZED');
  return identity.sub;
}

async function getCognitoUser(userId) {
  if (!USER_POOL_ID) return { id: userId, email: null, name: null, isAdmin: false };
  try {
    const out = await cognito.send(new AdminGetUserCommand({
      UserPoolId: USER_POOL_ID,
      Username: userId,
    }));
    const email = out.UserAttributes?.find((a) => a.Name === 'email')?.Value || null;
    const name = out.UserAttributes?.find((a) => a.Name === 'name')?.Value?.trim() || null;
    const isAdmin = email ? ADMIN_EMAILS.includes(email) : false;
    return { id: userId, email, name, isAdmin };
  } catch (e) {
    return { id: userId, email: null, name: null, isAdmin: false };
  }
}

async function getProfile(userId) {
  const r = await dynamo.send(new GetItemCommand({
    TableName: tables.profiles,
    Key: marshall({ userId }),
  }));
  if (!r.Item) return null;
  const p = unmarshall(r.Item);
  return await profileFromDoc(p);
}

async function profileFromDoc(d) {
  if (!d) return null;
  const schedule = d.availabilitySchedule;
  let scheduleParsed = [];
  if (typeof schedule === 'string' && schedule.startsWith('[')) {
    try {
      scheduleParsed = JSON.parse(schedule);
    } catch (_) {}
  }
  return {
    userId: d.userId,
    displayName: d.name || '',
    age: d.birthDate ? ageFromBirthDate(d.birthDate) : null,
    city: d.city || null,
    bio: d.bio || null,
    sports: d.sportTags || [],
    goals: d.goals || [],
    schedule: scheduleParsed,
    avatarUrl: await toAvatarUrl(d.photoUrls, d.photoKey, d.userId),
    level: d.level || null,
    isComplete: !!d.isComplete,
    updatedAt: d.updatedAt || null,
  };
}

function ageFromBirthDate(birthDate) {
  const d = new Date(birthDate);
  if (isNaN(d.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - d.getFullYear();
  if (today.getMonth() < d.getMonth() || (today.getMonth() === d.getMonth() && today.getDate() < d.getDate())) age--;
  return age >= 0 ? age : null;
}

async function getCreditsBalance(userId) {
  const r = await dynamo.send(new GetItemCommand({
    TableName: tables.userCredits,
    Key: marshall({ UserId: userId }),
  }));
  if (!r.Item) return { balance: 0, lifetimeEarned: 0 };
  const item = unmarshall(r.Item);
  const balance = item.Balance ?? 0;
  const lifetimeEarned = item.LifetimeEarned ?? balance;
  return { balance, lifetimeEarned };
}

async function getMe(identity) {
  const userId = getUserId(identity);
  const [user, profile, credits] = await Promise.all([
    getCognitoUser(userId),
    getProfile(userId),
    getCreditsBalance(userId),
  ]);
  const isProfileComplete = profile ? isProfileCompleteCheck(profile) : false;
  const displayName = (profile?.displayName?.trim() || user.name || '').trim() || null;
  const profileOut = profile
    ? { ...profile, displayName: displayName || profile.displayName || '', updatedAt: profile.updatedAt || null }
    : (displayName ? { userId, displayName, age: null, city: null, bio: null, sports: [], goals: [], schedule: [], avatarUrl: await toAvatarUrl(null, null, userId), level: null, isComplete: false, updatedAt: null } : null);
  return {
    user: {
      id: user.id,
      email: user.email,
      isAdmin: user.isAdmin,
      createdAt: null,
      updatedAt: null,
    },
    profile: profileOut,
    credits: credits.balance,
    lifetimeEarned: credits.lifetimeEarned,
    isProfileComplete,
  };
}

function isProfileCompleteCheck(p) {
  return !!(
    p.displayName?.trim() &&
    p.bio?.trim() && p.bio.length >= 20 && p.bio.length <= 500 &&
    Array.isArray(p.sports) && p.sports.length > 0 &&
    (p.level === undefined || p.level === null ? false : String(p.level).trim()) &&
    Array.isArray(p.schedule) && p.schedule.length > 0
  );
}

async function getPassedTargetIds(userId) {
  const passed = new Set();
  let lastKey = null;
  do {
    const r = await dynamo.send(new QueryCommand({
      TableName: tables.discoverPasses,
      KeyConditionExpression: 'userId = :u',
      ExpressionAttributeValues: marshall({ ':u': userId }),
      ProjectionExpression: 'targetUserId',
      ...(lastKey && { ExclusiveStartKey: lastKey }),
    }));
    for (const item of r.Items || []) {
      const row = unmarshall(item);
      if (row.targetUserId) passed.add(row.targetUserId);
    }
    lastKey = r.LastEvaluatedKey || null;
  } while (lastKey);
  return passed;
}

async function discoverCandidates(identity, args) {
  const userId = getUserId(identity);
  const passed = await getPassedTargetIds(userId);

  // Paginate profiles scan so we don't miss users when table has many items
  const all = [];
  let lastKey = null;
  do {
    const scanParams = {
      TableName: tables.profiles,
      Limit: 500,
      ...(lastKey && { ExclusiveStartKey: lastKey }),
    };
    const scan = await dynamo.send(new ScanCommand(scanParams));
    (scan.Items || []).forEach((i) => all.push(unmarshall(i)));
    lastKey = scan.LastEvaluatedKey || null;
  } while (lastKey);

  // Show all profiles except self and users this account has passed (so they don't reappear)
  const candidates = [];
  for (const doc of all) {
    const profileUserId = doc.userId;
    if (!profileUserId || profileUserId === userId) continue;
    if (passed.has(profileUserId)) continue;
    const p = await profileFromDoc(doc);
    if (!p) continue;
    // Show profile even if name is empty: use fallback so real users always appear in discover
    const displayName = (p.displayName && String(p.displayName).trim()) || 'User';
    const compatibilityScore = 50;
    candidates.push({
      userId: p.userId,
      displayName,
      age: p.age,
      city: p.city,
      bio: p.bio ? p.bio.slice(0, 120) : null,
      sports: p.sports || [],
      goals: p.goals || [],
      avatarUrl: p.avatarUrl || (() => { const n = String(p.userId).split('').reduce((a, b) => a + b.charCodeAt(0), 0); const idx = (n % 99) + 1; const g = n % 2 === 0 ? 'women' : 'men'; return `https://randomuser.me/api/portraits/${g}/${idx}.jpg`; })(),
      compatibilityScore,
    });
  }
  return { items: candidates, nextToken: null };
}

async function listMyMatches(identity) {
  const userId = getUserId(identity);
  const scan = await dynamo.send(new ScanCommand({
    TableName: tables.matches,
    FilterExpression: 'isMatched = :t AND (userId1 = :u OR userId2 = :u)',
    ExpressionAttributeValues: marshall({ ':t': true, ':u': userId }),
  }));
  const items = [];
  for (const item of scan.Items || []) {
    const m = unmarshall(item);
    const otherUserId = m.userId1 === userId ? m.userId2 : m.userId1;
    const otherProfile = await getProfile(otherUserId);
    if (!otherProfile) continue;
    const threadId = m.matchId;
    const threadRes = await dynamo.send(new GetItemCommand({
      TableName: tables.chatThreads,
      Key: marshall({ threadId }),
    }));
    let unlockedByMe = false;
    if (threadRes.Item) {
      const t = unmarshall(threadRes.Item);
      const participantIds = t.participantIds || [];
      const isUserA = participantIds[0] === userId;
      unlockedByMe = isUserA ? !!t.unlockedByUserA : !!t.unlockedByUserB;
    }
    items.push({
      matchId: m.matchId,
      otherUserProfile: otherProfile,
      threadId,
      unlockedByMe,
      createdAt: m.createdAt || null,
    });
  }
  return { items };
}

async function getThreadByMatch(identity, args) {
  const userId = getUserId(identity);
  const matchId = args.matchId;
  if (!matchId) return null;
  const matchRes = await dynamo.send(new GetItemCommand({
    TableName: tables.matches,
    Key: marshall({ matchId }),
  }));
  if (!matchRes.Item) return null;
  const match = unmarshall(matchRes.Item);
  if (match.userId1 !== userId && match.userId2 !== userId) return null;
  const otherUserId = match.userId1 === userId ? match.userId2 : match.userId1;
  const threadRes = await dynamo.send(new GetItemCommand({
    TableName: tables.chatThreads,
    Key: marshall({ threadId: matchId }),
  }));
  let thread = threadRes.Item ? unmarshall(threadRes.Item) : null;
  if (!thread) {
    thread = {
      threadId: matchId,
      matchId,
      userA: match.userId1,
      userB: match.userId2,
      unlockedByUserA: false,
      unlockedByUserB: false,
      participantIds: [match.userId1, match.userId2],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }
  const participantIds = thread.participantIds || [thread.userA, thread.userB];
  const isUserA = participantIds[0] === userId;
  const unlockedByCurrentUser = isUserA ? !!thread.unlockedByUserA : !!thread.unlockedByUserB;
  const otherUserProfile = await getProfile(otherUserId);
  return {
    threadId: thread.threadId || matchId,
    matchId,
    userA: participantIds[0],
    userB: participantIds[1],
    unlockedByUserA: !!thread.unlockedByUserA,
    unlockedByUserB: !!thread.unlockedByUserB,
    unlockedByCurrentUser,
    otherUserProfile,
    createdAt: thread.createdAt,
    updatedAt: thread.updatedAt,
  };
}

async function listMessages(identity, args) {
  const userId = getUserId(identity);
  const threadId = args.threadId;
  if (!threadId) return { items: [], nextToken: null };
  const threadRes = await dynamo.send(new GetItemCommand({
    TableName: tables.chatThreads,
    Key: marshall({ threadId }),
  }));
  if (!threadRes.Item) return { items: [], nextToken: null };
  const thread = unmarshall(threadRes.Item);
  const participantIds = thread.participantIds || [];
  if (!participantIds.includes(userId)) return { items: [], nextToken: null };
  const limit = Math.min(Math.max(args?.limit || 30, 1), 100);
  const q = await dynamo.send(new QueryCommand({
    TableName: tables.messages,
    KeyConditionExpression: 'threadId = :tid',
    ExpressionAttributeValues: marshall({ ':tid': threadId }),
    Limit: 500,
  }));
  const all = (q.Items || []).map((i) => {
    const m = unmarshall(i);
    return {
      id: m.messageId,
      threadId: m.threadId,
      createdAt: m.createdAt,
      fromUserId: m.senderId,
      body: m.content,
      senderName: m.senderName,
    };
  });
  all.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const items = all.slice(0, limit).reverse();
  return { items, nextToken: null };
}

async function ensureFreeStartCredits(identity) {
  const userId = getUserId(identity);
  const txTable = tables.creditTransactions;
  const scan = await dynamo.send(new ScanCommand({
    TableName: txTable,
    FilterExpression: 'UserId = :u AND #r = :reason',
    ExpressionAttributeNames: { '#r': 'Reason' },
    ExpressionAttributeValues: marshall({ ':u': userId, ':reason': FREE_START_REASON }),
    Limit: 1,
  }));
  if (scan.Items && scan.Items.length > 0) return true;
  const userRes = await dynamo.send(new GetItemCommand({
    TableName: tables.userCredits,
    Key: marshall({ UserId: userId }),
  }));
  let balance = 0;
  let lifetimeEarned = 0;
  if (userRes.Item) {
    const u = unmarshall(userRes.Item);
    balance = u.Balance ?? 0;
    lifetimeEarned = u.LifetimeEarned ?? 0;
  }
  balance += FREE_START_CREDITS;
  lifetimeEarned += FREE_START_CREDITS;
  const now = new Date().toISOString();
  await dynamo.send(new PutItemCommand({
    TableName: tables.userCredits,
    Item: marshall({
      UserId: userId,
      Balance: balance,
      LifetimeEarned: lifetimeEarned,
      UpdatedAt: now,
    }),
  }));
  await dynamo.send(new PutItemCommand({
    TableName: txTable,
    Item: marshall({
      Id: require('crypto').randomUUID(),
      UserId: userId,
      Type: 'GRANT',
      CreditsDelta: FREE_START_CREDITS,
      Reason: FREE_START_REASON,
      RefId: FREE_START_REASON,
      CreatedAt: now,
    }),
  }));
  return true;
}

async function spendCredits(userId, amount, reason, refId) {
  const userRes = await dynamo.send(new GetItemCommand({
    TableName: tables.userCredits,
    Key: marshall({ UserId: userId }),
  }));
  let balance = 0;
  let lifetimeEarned = 0;
  if (userRes.Item) {
    const u = unmarshall(userRes.Item);
    balance = u.Balance ?? 0;
    lifetimeEarned = u.LifetimeEarned ?? 0;
  }
  if (balance < amount) throw new Error('INSUFFICIENT_CREDITS');
  const newBalance = balance - amount;
  const now = new Date().toISOString();
  await dynamo.send(new PutItemCommand({
    TableName: tables.userCredits,
    Item: marshall({
      UserId: userId,
      Balance: newBalance,
      LifetimeEarned: lifetimeEarned,
      UpdatedAt: now,
    }),
  }));
  await dynamo.send(new PutItemCommand({
    TableName: tables.creditTransactions,
    Item: marshall({
      Id: require('crypto').randomUUID(),
      UserId: userId,
      Type: 'SPEND',
      CreditsDelta: -amount,
      Reason: reason,
      RefId: refId || undefined,
      CreatedAt: now,
    }),
  }));
}

async function likeUser(identity, args) {
  const userId = getUserId(identity);
  const toUserId = args.toUserId;
  if (!toUserId) throw new Error('toUserId required');
  await spendCredits(userId, 1, CREDIT_REASON_LIKE, toUserId);
  const matchRes = await dynamo.send(new ScanCommand({
    TableName: tables.matches,
    FilterExpression: '(userId1 = :a AND userId2 = :b) OR (userId1 = :b AND userId2 = :a)',
    ExpressionAttributeValues: marshall({ ':a': userId, ':b': toUserId }),
    Limit: 1,
  }));
  let match = matchRes.Items && matchRes.Items.length ? unmarshall(matchRes.Items[0]) : null;
  const isInitiator = match ? match.userId1 === userId : true;
  if (!match) {
    const matchId = require('crypto').randomUUID();
    match = {
      matchId,
      userId1: userId,
      userId2: toUserId,
      user1Liked: true,
      user2Liked: false,
      isMatched: false,
      compatibilityScore: 50,
      commonSports: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await dynamo.send(new PutItemCommand({
      TableName: tables.matches,
      Item: marshall(match),
    }));
  } else {
    if (isInitiator) {
      match.user1Liked = true;
    } else {
      match.user2Liked = true;
    }
    match.isMatched = match.user1Liked && match.user2Liked;
    match.updatedAt = new Date().toISOString();
    await dynamo.send(new PutItemCommand({
      TableName: tables.matches,
      Item: marshall(match),
    }));
    if (match.isMatched) {
      const threadRes = await dynamo.send(new GetItemCommand({
        TableName: tables.chatThreads,
        Key: marshall({ threadId: match.matchId }),
      }));
      if (!threadRes.Item) {
        await dynamo.send(new PutItemCommand({
          TableName: tables.chatThreads,
          Item: marshall({
            threadId: match.matchId,
            matchId: match.matchId,
            participantIds: [match.userId1, match.userId2],
            unlockedByUserA: false,
            unlockedByUserB: false,
            lastMessage: null,
            lastMessageAt: null,
            createdAt: match.updatedAt,
            updatedAt: match.updatedAt,
          }),
        }));
      }
    }
  }
  return {
    matchId: match.matchId,
    isMatched: !!match.isMatched,
    compatibilityScore: match.compatibilityScore || 50,
  };
}

async function passUserMutation(identity, args) {
  const userId = getUserId(identity);
  const targetUserId = args.targetUserId;
  if (!targetUserId) throw new Error('targetUserId required');
  const now = new Date().toISOString();
  await dynamo.send(new PutItemCommand({
    TableName: tables.discoverPasses,
    Item: marshall({ userId, targetUserId, createdAt: now }),
  }));
  const matchRes = await dynamo.send(new ScanCommand({
    TableName: tables.matches,
    FilterExpression: '(userId1 = :a AND userId2 = :b) OR (userId1 = :b AND userId2 = :a)',
    ExpressionAttributeValues: marshall({ ':a': userId, ':b': targetUserId }),
    Limit: 1,
  }));
  if (matchRes.Items?.length) {
    const m = unmarshall(matchRes.Items[0]);
    await dynamo.send(new DeleteItemCommand({
      TableName: tables.matches,
      Key: marshall({ matchId: m.matchId }),
    }));
  }
  return true;
}

async function unlockChat(identity, args) {
  const userId = getUserId(identity);
  const matchId = args.matchId;
  if (!matchId) throw new Error('matchId required');
  const matchRes = await dynamo.send(new GetItemCommand({
    TableName: tables.matches,
    Key: marshall({ matchId }),
  }));
  if (!matchRes.Item) throw new Error('MATCH_NOT_FOUND');
  const match = unmarshall(matchRes.Item);
  if (match.userId1 !== userId && match.userId2 !== userId) throw new Error('FORBIDDEN');
  const threadRes = await dynamo.send(new GetItemCommand({
    TableName: tables.chatThreads,
    Key: marshall({ threadId: matchId }),
  }));
  let thread = threadRes.Item ? unmarshall(threadRes.Item) : null;
  if (!thread) {
    const now = new Date().toISOString();
    thread = {
      threadId: matchId,
      matchId,
      participantIds: [match.userId1, match.userId2],
      unlockedByUserA: false,
      unlockedByUserB: false,
      lastMessage: null,
      lastMessageAt: null,
      createdAt: now,
      updatedAt: now,
    };
    await dynamo.send(new PutItemCommand({
      TableName: tables.chatThreads,
      Item: marshall(thread),
    }));
  }
  const participantIds = thread.participantIds || [match.userId1, match.userId2];
  const isUserA = participantIds[0] === userId;
  if (isUserA && thread.unlockedByUserA) return { threadId: matchId, unlocked: true };
  if (!isUserA && thread.unlockedByUserB) return { threadId: matchId, unlocked: true };
  await spendCredits(userId, 1, CREDIT_REASON_CHAT_UNLOCK, matchId);
  if (isUserA) thread.unlockedByUserA = true;
  else thread.unlockedByUserB = true;
  thread.updatedAt = new Date().toISOString();
  await dynamo.send(new PutItemCommand({
    TableName: tables.chatThreads,
    Item: marshall(thread),
  }));
  return { threadId: matchId, unlocked: true };
}

async function countMessagesFromSender(threadId, senderId) {
  const q = await dynamo.send(new QueryCommand({
    TableName: tables.messages,
    KeyConditionExpression: 'threadId = :tid',
    ExpressionAttributeValues: marshall({ ':tid': threadId }),
    Limit: 500,
  }));
  const items = (q.Items || []).map((i) => unmarshall(i));
  return items.filter((m) => m.senderId === senderId).length;
}

async function createMessage(identity, args) {
  const userId = getUserId(identity);
  const body = (args.body || '').trim();
  if (!body) throw new Error('body required');
  const matchId = args.matchId;
  const threadIdArg = args.threadId;
  let threadId = threadIdArg;
  if (!threadId && matchId) threadId = matchId;
  if (!threadId) throw new Error('threadId or matchId required');
  const threadRes = await dynamo.send(new GetItemCommand({
    TableName: tables.chatThreads,
    Key: marshall({ threadId }),
  }));
  if (!threadRes.Item) throw new Error('THREAD_NOT_FOUND');
  const thread = unmarshall(threadRes.Item);
  const participantIds = thread.participantIds || [];
  if (!participantIds.includes(userId)) throw new Error('FORBIDDEN');
  const isUserA = participantIds[0] === userId;
  const unlockedFlag = isUserA ? !!thread.unlockedByUserA : !!thread.unlockedByUserB;
  if (!unlockedFlag) {
    const sent = await countMessagesFromSender(threadId, userId);
    if (sent > 0) throw new Error('CHAT_LOCKED');
    // First outbound message is free (no unlock credit). Further messages require unlock.
  }
  const profile = await getProfile(userId);
  const senderName = profile?.displayName || 'User';
  const messageId = require('crypto').randomUUID();
  const now = new Date().toISOString();
  const message = {
    threadId,
    messageId,
    senderId: userId,
    senderName,
    content: body,
    isRead: false,
    createdAt: now,
  };
  await dynamo.send(new PutItemCommand({
    TableName: tables.messages,
    Item: marshall(message),
  }));
  thread.lastMessage = body;
  thread.lastMessageAt = now;
  thread.updatedAt = now;
  await dynamo.send(new PutItemCommand({
    TableName: tables.chatThreads,
    Item: marshall(thread),
  }));
  return {
    id: messageId,
    threadId,
    createdAt: now,
    fromUserId: userId,
    body,
    senderName,
  };
}

async function upsertProfile(identity, args) {
  const userId = getUserId(identity);
  const input = args.input || {};
  const existing = await dynamo.send(new GetItemCommand({
    TableName: tables.profiles,
    Key: marshall({ userId }),
  }));
  const now = new Date().toISOString();
  let doc = existing.Item ? unmarshall(existing.Item) : { userId, email: '', name: '', mode: 'TRAIN', isComplete: false, createdAt: now, updatedAt: now };
  if (input.displayName != null) doc.name = input.displayName;
  if (input.age != null) doc.age = input.age;
  if (input.city != null) doc.city = input.city;
  if (input.bio != null) doc.bio = input.bio;
  if (input.sports != null) doc.sportTags = input.sports;
  if (input.goals != null) doc.goals = input.goals;
  if (input.avatarUrl != null) doc.photoUrls = [input.avatarUrl];
  if (input.schedule != null && input.schedule.length > 0) doc.availabilitySchedule = JSON.stringify(input.schedule);
  doc.updatedAt = now;
  const profileForCheck = await profileFromDoc(doc);
  doc.isComplete = isProfileCompleteCheck(profileForCheck);
  await dynamo.send(new PutItemCommand({
    TableName: tables.profiles,
    Item: marshall(doc),
  }));
  return profileForCheck;
}

async function seedDemoData(identity) {
  const userId = getUserId(identity);
  const user = await getCognitoUser(userId);
  if (!user.isAdmin) throw new Error('FORBIDDEN');
  const now = new Date().toISOString();
  const dummyUsers = [
    { userId: 'dummy-user-1', name: 'Sarah Runner', city: 'San Francisco', bio: 'Marathon runner looking for training partners.', sportTags: ['Running', 'Yoga'], goals: ['Sub-4 marathon'], availabilitySchedule: JSON.stringify([{ days: ['Mon', 'Wed'], timeStart: '18:00', timeEnd: '20:00' }]) },
    { userId: 'dummy-user-2', name: 'Mike Cyclist', city: 'San Francisco', bio: 'Cycling enthusiast. Weekend ride buddies.', sportTags: ['Cycling', 'Gym'], goals: ['Century ride'], availabilitySchedule: JSON.stringify([{ days: ['Sat', 'Sun'], timeStart: '08:00', timeEnd: '12:00' }]) },
    { userId: 'dummy-user-3', name: 'Emma Yoga', city: 'San Francisco', bio: 'Yoga instructor. Morning sessions!', sportTags: ['Yoga', 'Pilates'], goals: ['Build community'], availabilitySchedule: JSON.stringify([{ days: ['Mon', 'Wed'], timeStart: '06:00', timeEnd: '08:00' }]) },
    { userId: 'dummy-user-4', name: 'Alex Hyrox', city: 'San Francisco', bio: 'Hyrox competitor. Training partners!', sportTags: ['Hyrox', 'CrossFit'], goals: ['Qualify Worlds'], availabilitySchedule: JSON.stringify([{ days: ['Tue', 'Thu'], timeStart: '17:00', timeEnd: '20:00' }]) },
    { userId: 'dummy-user-5', name: 'Jordan Pickleball', city: 'San Francisco', bio: 'Pickleball player. Doubles partners!', sportTags: ['Pickleball', 'Tennis'], goals: ['Improve ranking'], availabilitySchedule: JSON.stringify([{ days: ['Mon', 'Wed'], timeStart: '19:00', timeEnd: '21:00' }]) },
    { userId: 'dummy-user-6', name: 'Maya Chen', city: 'San Francisco', bio: 'CrossFit & running. Looking for motivated training buddies!', sportTags: ['CrossFit', 'Running', 'HIIT'], goals: ['Half marathon'], availabilitySchedule: JSON.stringify([{ days: ['Tue', 'Thu', 'Sat'], timeStart: '07:00', timeEnd: '09:00' }]) },
    { userId: 'dummy-user-7', name: 'Jess Martinez', city: 'San Francisco', bio: 'Strength and conditioning. Let\'s get strong together.', sportTags: ['Strength', 'Gym', 'Yoga'], goals: ['Build strength'], availabilitySchedule: JSON.stringify([{ days: ['Mon', 'Wed', 'Fri'], timeStart: '18:00', timeEnd: '20:00' }]) },
    { userId: 'dummy-user-8', name: 'Riley Taylor', city: 'San Francisco', bio: 'Triathlon training. Swim, bike, run — always up for a session.', sportTags: ['Swimming', 'Cycling', 'Running'], goals: ['Sprint tri'], availabilitySchedule: JSON.stringify([{ days: ['Sat', 'Sun'], timeStart: '06:00', timeEnd: '10:00' }]) },
  ];
  let created = 0;
  let updated = 0;
  for (let i = 0; i < dummyUsers.length; i++) {
    const u = dummyUsers[i];
    const photoUrls = [DEMO_PERSON_PHOTOS[i]];
    const exists = await dynamo.send(new GetItemCommand({
      TableName: tables.profiles,
      Key: marshall({ userId: u.userId }),
    }));
    if (exists.Item) {
      await dynamo.send(new UpdateItemCommand({
        TableName: tables.profiles,
        Key: marshall({ userId: u.userId }),
        UpdateExpression: 'SET photoUrls = :urls, updatedAt = :now',
        ExpressionAttributeValues: marshall({ ':urls': photoUrls, ':now': now }),
      }));
      updated++;
      continue;
    }
    const doc = {
      userId: u.userId,
      email: `${u.userId}@test.com`,
      name: u.name,
      city: u.city,
      bio: u.bio,
      sportTags: u.sportTags,
      goals: u.goals,
      level: 'intermediate',
      mode: 'TRAIN',
      isComplete: true,
      availabilitySchedule: u.availabilitySchedule,
      photoUrls,
      createdAt: now,
      updatedAt: now,
    };
    await dynamo.send(new PutItemCommand({
      TableName: tables.profiles,
      Item: marshall(doc),
    }));
    created++;
  }
  const msg = [created && `Created ${created}`, updated && `updated photos for ${updated} existing`].filter(Boolean).join('; ') || 'No changes.';
  return { created, message: `Demo profiles: ${msg}.` };
}

async function getProfileByUserId(identity, args) {
  getUserId(identity);
  const userId = args?.userId;
  if (!userId) throw new Error('userId is required');
  return getProfile(userId);
}

const queryHandlers = {
  getMe: (identity) => getMe(identity),
  getProfile: (identity, args) => getProfileByUserId(identity, args),
  discoverCandidates: (identity, args) => discoverCandidates(identity, args),
  listMyMatches: (identity) => listMyMatches(identity),
  getThreadByMatch: (identity, args) => getThreadByMatch(identity, args),
  listMessages: (identity, args) => listMessages(identity, args),
};

const mutationHandlers = {
  ensureFreeStartCredits: (identity) => ensureFreeStartCredits(identity),
  likeUser: (identity, args) => likeUser(identity, args),
  passUser: (identity, args) => passUserMutation(identity, args),
  unlockChat: (identity, args) => unlockChat(identity, args),
  createMessage: (identity, args) => createMessage(identity, args),
  upsertProfile: (identity, args) => upsertProfile(identity, args),
  seedDemoData: (identity) => seedDemoData(identity),
};

exports.handler = async (event) => {
  // AppSync can send: (a) payload from our VTL template: { payload: { typeName, fieldName, arguments, identity } }
  // or (b) context directly: { typeName, fieldName, info: { parentTypeName, fieldName }, arguments, identity }
  const p = event.payload ?? event;
  const typeName = p.typeName ?? event.typeName ?? p.info?.parentTypeName ?? event.info?.parentTypeName;
  const fieldName = p.fieldName ?? event.fieldName ?? p.info?.fieldName ?? event.info?.fieldName;
  const args = p.arguments ?? event.arguments ?? {};
  const identityObj = p.identity ?? event.identity ?? event.request?.identity;

  if (typeName == null || typeName === '' || fieldName == null || fieldName === '') {
    console.error('[AppSync] Missing typeName or fieldName. Event keys:', Object.keys(event));
    console.error('[AppSync] payload keys:', event.payload ? Object.keys(event.payload) : 'no payload');
    console.error('[AppSync] event.info:', JSON.stringify(event.info));
    console.error('[AppSync] event.payload (sanitized):', event.payload ? { typeName: p.typeName, fieldName: p.fieldName, hasArguments: !!p.arguments, hasIdentity: !!p.identity } : 'n/a');
  }

  try {
    if (typeName === 'Query' && queryHandlers[fieldName]) {
      return await queryHandlers[fieldName](identityObj, args);
    }
    if (typeName === 'Mutation' && mutationHandlers[fieldName]) {
      return await mutationHandlers[fieldName](identityObj, args);
    }
    throw new Error(`Unknown field: ${String(typeName)}.${String(fieldName)}`);
  } catch (err) {
    if (err.message === 'UNAUTHORIZED' || err.message === 'FORBIDDEN') throw err;
    if (err.message === 'INSUFFICIENT_CREDITS') throw err;
    console.error(typeName, fieldName, err);
    throw err;
  }
};
