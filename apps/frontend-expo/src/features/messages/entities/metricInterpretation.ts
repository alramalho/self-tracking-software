export function metricInterpretation(
  metricTitle: string,
  rating: number,
  coachName: string,
): string {
  const lowerTitle = metricTitle.toLowerCase();

  // Generate interpretation based on rating and metric type
  const getRatingAdjective = () => {
    if (rating >= 4) return "really";
    if (rating === 3) return "somewhat";
    return "not very";
  };

  const getRatingIntensity = () => {
    if (rating === 5) return "very";
    if (rating === 4) return "quite";
    if (rating === 3) return "moderately";
    if (rating === 2) return "a bit";
    return "not";
  };

  // Common metric interpretations
  if (lowerTitle.includes("happy") || lowerTitle.includes("happiness")) {
    if (rating >= 4)
      return `${coachName} thinks you felt ${getRatingAdjective()} happy today`;
    if (rating === 3) return `${coachName} thinks you felt okay today`;
    return `${coachName} thinks you didn't feel ${getRatingIntensity()} happy today`;
  }

  if (lowerTitle.includes("energy") || lowerTitle.includes("energetic")) {
    if (rating >= 4)
      return `${coachName} thinks you felt ${getRatingAdjective()} energetic today`;
    if (rating === 3)
      return `${coachName} thinks you had moderate energy today`;
    return `${coachName} thinks you didn't feel ${getRatingIntensity()} energetic today`;
  }

  if (lowerTitle.includes("stress")) {
    if (rating >= 4)
      return `${coachName} thinks you felt ${getRatingAdjective()} stressed today`;
    if (rating === 3)
      return `${coachName} thinks you felt moderately stressed today`;
    return `${coachName} thinks you felt ${getRatingIntensity()} stressed today`;
  }

  if (lowerTitle.includes("motivation") || lowerTitle.includes("motivated")) {
    if (rating >= 4)
      return `${coachName} thinks you felt ${getRatingAdjective()} motivated today`;
    if (rating === 3)
      return `${coachName} thinks you felt moderately motivated today`;
    return `${coachName} thinks you didn't feel ${getRatingIntensity()} motivated today`;
  }

  if (lowerTitle.includes("focus") || lowerTitle.includes("concentrated")) {
    if (rating >= 4)
      return `${coachName} thinks you were ${getRatingAdjective()} focused today`;
    if (rating === 3) return `${coachName} thinks you had moderate focus today`;
    return `${coachName} thinks you weren't ${getRatingIntensity()} focused today`;
  }

  // Generic fallback
  if (rating >= 4)
    return `${coachName} thinks your ${lowerTitle} was ${getRatingIntensity()} high today`;
  if (rating === 3)
    return `${coachName} thinks your ${lowerTitle} was moderate today`;
  return `${coachName} thinks your ${lowerTitle} was ${getRatingIntensity()} high today`;
}
