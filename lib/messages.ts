const MESSAGES = [
  "You carry so much and still show up with grace. That doesn't go unnoticed.",
  "The way you move through life inspires me more than you know.",
  "You have this quiet strength that makes everyone around you feel safe.",
  "You are so much more than you give yourself credit for.",
  "The world is genuinely better because you're in it.",
  "You light up every room without even trying.",
  "Your kindness is one of the rarest things I've ever encountered.",
  "You think deeply, feel deeply, and love deeply. That's a gift.",
  "Watching you grow has been one of my greatest privileges.",
  "You handle hard things with a kind of dignity that leaves me in awe.",
  "You are the definition of someone who makes things better just by being present.",
  "Your laugh is one of those sounds that makes everything feel lighter.",
  "You deserve every good thing heading your way and so much more.",
  "There's something about your spirit that just can't be dimmed.",
  "You work so hard and ask for so little. I see that.",
  "You make people feel seen. Do you know how rare that is?",
  "Your strength isn't loud but it's unshakeable.",
  "Everything you touch, you make more beautiful somehow.",
  "You are someone worth showing up for, always.",
  "Your heart is one of the most beautiful things about you.",
  "You carry your story with so much courage.",
  "You've overcome more than most people will ever understand.",
  "Your mind is brilliant. Never let anyone make you doubt that.",
  "You are deeply, completely worthy of good things.",
  "The care you put into everything you do, it shows.",
  "You make ordinary moments feel meaningful.",
  "Your presence is a gift people don't always know how to say thank you for.",
  "You are enough. Exactly as you are, right now.",
  "The way you keep going, even on hard days. That's real strength.",
  "You have a warmth that stays with people long after you've left the room.",
  "You are seen, you are valued, and you are appreciated deeply.",
  "Your resilience is something I genuinely look up to.",
  "You give so much of yourself. I hope someone gives that back to you.",
  "You are not just important to the people around you, you're irreplaceable.",
  "There is no one quite like you, and the world is richer for it.",
  "You face things head-on with a kind of bravery most people only wish they had.",
  "Your softness is not weakness. It's one of your greatest strengths.",
  "You've touched more lives than you'll ever fully realize.",
  "Thank you for being exactly who you are. The world needs more of you.",
];

export function getMessage(): string {
  const dayIndex = Math.floor(Date.now() / (1000 * 60 * 60 * 24));
  return MESSAGES[dayIndex % MESSAGES.length];
}

export function msUntilMidnight(): number {
  const now = new Date();
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return midnight.getTime() - now.getTime();
}
