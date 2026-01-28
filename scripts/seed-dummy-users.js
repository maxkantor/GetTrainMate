/**
 * Seed Dummy Users Script
 * Creates test users with profiles for development/testing
 * 
 * Usage:
 *   node scripts/seed-dummy-users.js
 * 
 * Or with API URL:
 *   API_URL=https://your-api-url.com node scripts/seed-dummy-users.js
 */

const API_URL = process.env.API_URL || 'https://goskwzjzjg.execute-api.us-east-1.amazonaws.com';

// Dummy users to create
const DUMMY_USERS = [
  {
    userId: 'dummy-user-1',
    email: 'runner@test.com',
    name: 'Sarah Runner',
    city: 'San Francisco',
    bio: 'Marathon runner looking for training partners. Love long runs on weekends!',
    sportTags: ['Running', 'Yoga', 'Hiking'],
    level: 'intermediate',
    goals: 'Complete a sub-4 hour marathon',
    mode: 'TRAIN',
    photoUrls: [],
  },
  {
    userId: 'dummy-user-2',
    email: 'cyclist@test.com',
    name: 'Mike Cyclist',
    city: 'San Francisco',
    bio: 'Cycling enthusiast. Looking for weekend ride buddies.',
    sportTags: ['Cycling', 'Gym', 'CrossFit'],
    level: 'advanced',
    goals: 'Complete a century ride',
    mode: 'VIBE',
    photoUrls: [],
  },
  {
    userId: 'dummy-user-3',
    email: 'yoga@test.com',
    name: 'Emma Yoga',
    city: 'San Francisco',
    bio: 'Yoga instructor and fitness enthusiast. Love morning yoga sessions!',
    sportTags: ['Yoga', 'Pilates', 'Meditation'],
    level: 'pro',
    goals: 'Build a yoga community',
    mode: 'VIBE',
    photoUrls: [],
  },
  {
    userId: 'dummy-user-4',
    email: 'hyrox@test.com',
    name: 'Alex Hyrox',
    city: 'San Francisco',
    bio: 'Hyrox competitor training for next race. Need training partners!',
    sportTags: ['Hyrox', 'CrossFit', 'Running', 'Gym'],
    level: 'advanced',
    goals: 'Qualify for Hyrox World Championships',
    mode: 'TRAIN',
    photoUrls: [],
  },
  {
    userId: 'dummy-user-5',
    email: 'pickleball@test.com',
    name: 'Jordan Pickleball',
    city: 'San Francisco',
    bio: 'Pickleball player looking for doubles partners. Play 3x a week!',
    sportTags: ['Pickleball', 'Tennis', 'Volleyball'],
    level: 'intermediate',
    goals: 'Improve tournament ranking',
    mode: 'VIBE',
    photoUrls: [],
  },
  {
    userId: 'dummy-user-6',
    email: 'fishing@test.com',
    name: 'Chris Fisher',
    city: 'San Francisco',
    bio: 'Fishing enthusiast. Love early morning fishing trips!',
    sportTags: ['Fishing', 'Hiking', 'Kayaking'],
    level: 'beginner',
    goals: 'Learn new fishing techniques',
    mode: 'VIBE',
    photoUrls: [],
  },
  {
    userId: 'dummy-user-7',
    email: 'soccer@test.com',
    name: 'Maria Soccer',
    city: 'San Francisco',
    bio: 'Soccer player looking for pickup games and training partners.',
    sportTags: ['Soccer', 'Running', 'Gym'],
    level: 'intermediate',
    goals: 'Join a competitive league',
    mode: 'TRAIN',
    photoUrls: [],
  },
  {
    userId: 'dummy-user-8',
    email: 'swimmer@test.com',
    name: 'David Swimmer',
    city: 'San Francisco',
    bio: 'Competitive swimmer. Training for triathlons.',
    sportTags: ['Swimming', 'Cycling', 'Running', 'Triathlon'],
    level: 'advanced',
    goals: 'Complete an Ironman',
    mode: 'TRAIN',
    photoUrls: [],
  },
];

async function createDummyUser(userData, adminToken) {
  try {
    const response = await fetch(`${API_URL}/api/profile/${userData.userId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        name: userData.name,
        city: userData.city,
        bio: userData.bio,
        sportTags: userData.sportTags,
        level: userData.level,
        goals: userData.goals,
        mode: userData.mode,
        photoUrls: userData.photoUrls,
        isComplete: true,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to create user ${userData.name}: ${response.status} ${errorText}`);
    }

    const result = await response.json();
    console.log(`✅ Created: ${userData.name} (${userData.email})`);
    return result;
  } catch (error) {
    console.error(`❌ Error creating ${userData.name}:`, error.message);
    throw error;
  }
}

async function main() {
  console.log('🌱 Seeding Dummy Users...\n');
  console.log(`API URL: ${API_URL}\n`);

  // Note: In production, you'd need an admin token
  // For now, this script assumes you'll run it with proper authentication
  // or modify the backend to allow public seeding in dev mode
  
  const adminToken = process.env.ADMIN_TOKEN || '';
  
  if (!adminToken) {
    console.log('⚠️  No ADMIN_TOKEN provided. This script requires admin authentication.');
    console.log('   You can either:');
    console.log('   1. Set ADMIN_TOKEN environment variable');
    console.log('   2. Modify the backend to allow seeding in dev mode');
    console.log('   3. Use the admin API to create users manually\n');
    console.log('   Example: ADMIN_TOKEN=your-token node scripts/seed-dummy-users.js\n');
    return;
  }

  console.log('Creating dummy users...\n');

  let successCount = 0;
  let failCount = 0;

  for (const user of DUMMY_USERS) {
    try {
      await createDummyUser(user, adminToken);
      successCount++;
      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error) {
      failCount++;
    }
  }

  console.log(`\n✅ Successfully created: ${successCount} users`);
  if (failCount > 0) {
    console.log(`❌ Failed to create: ${failCount} users`);
  }
  console.log('\n🎉 Done! You can now see these users in the Discovery feed.');
}

main().catch(console.error);
