// Central place to manage marketing/hero/pricing imagery.
// Swap URLs with your own CDN/bucket paths (e.g., https://your-bucket.s3.region.amazonaws.com).
// For GetTrainMate: point to getrainmate-media-bucket on S3.
export const IMAGE_BUCKET_BASE = 'https://getrainmate-media-bucket.s3.us-east-1.amazonaws.com';

// Pricing "Meet the vibe" strip images.
// Replace src values with your own assets while keeping width/height for CLS stability.
export const PRICING_VIBE_IMAGES = [
  {
    src: `${IMAGE_BUCKET_BASE}/pricing/vibe/strength.jpg`,
    alt: 'Strength training',
    caption: 'Real training partners',
    width: 600,
    height: 400,
    fallback: 'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&q=80',
  },
  {
    src: `${IMAGE_BUCKET_BASE}/pricing/vibe/running.jpg`,
    alt: 'Running outdoors',
    caption: 'Motivation + consistency',
    width: 600,
    height: 400,
    fallback: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&q=80',
  },
  {
    src: `${IMAGE_BUCKET_BASE}/pricing/vibe/yoga.jpg`,
    alt: 'Yoga practice',
    caption: 'Recovery matters',
    width: 600,
    height: 400,
    fallback: 'https://images.unsplash.com/photo-1506126613408-eca07ce68773?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&q=80',
  },
  {
    src: `${IMAGE_BUCKET_BASE}/pricing/vibe/cycling.jpg`,
    alt: 'Cycling training',
    caption: 'Endurance days',
    width: 600,
    height: 400,
    fallback: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&q=80',
  },
  {
    src: `${IMAGE_BUCKET_BASE}/pricing/vibe/gym.jpg`,
    alt: 'Gym motivation',
    caption: 'Focus + flow',
    width: 600,
    height: 400,
    fallback: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&q=80',
  },
  {
    src: `${IMAGE_BUCKET_BASE}/pricing/vibe/fitness.jpg`,
    alt: 'Fitness training',
    caption: 'Performance gains',
    width: 600,
    height: 400,
    fallback: 'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&q=80',
  },
];
