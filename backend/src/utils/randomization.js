// Randomization utilities
const getRandomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const getRandomFloat = (min, max) => Math.random() * (max - min) + min;

// Generate daily total based on target-based quota with randomization
const generateDailyTotal = (baseTotal, dayNumber, quotaDays = 33, targetSum = 450000) => {
  // Calculate the base quota for this day using geometric progression
  const baseQuota = calculateTargetBasedQuota(baseTotal, dayNumber, quotaDays, targetSum);
  
  // Apply randomization factor (±5-15% based on day)
  const randomizationPercent = 0.05 + (Math.random() * 0.10); // 5-15%
  const randomAdjustment = getRandomInt(
    -Math.floor(baseQuota * randomizationPercent),
    Math.floor(baseQuota * randomizationPercent)
  );
  
  return Math.max(1, Math.floor(baseQuota + randomAdjustment));
};

// Calculate target-based quota for a specific day
const calculateTargetBasedQuota = (start, dayNumber, quotaDays, targetSum) => {
  // For days beyond the quota period, continue with growth pattern
  if (dayNumber > quotaDays) {
    // Calculate the last day's quota and continue growing
    const lastDayQuota = calculateTargetBasedQuota(start, quotaDays, quotaDays, targetSum);
    const additionalDays = dayNumber - quotaDays;
    // Continue with a moderate growth rate (3-7% per day)
    const continuedGrowthRate = 1.03 + (Math.random() * 0.04); // 3-7%
    return Math.floor(lastDayQuota * Math.pow(continuedGrowthRate, additionalDays));
  }
  
  // Calculate growth rate needed to reach target
  function geometricSum(r) {
    if (r === 1) return start * quotaDays;
    return start * (Math.pow(r, quotaDays) - 1) / (r - 1);
  }
  
  // Binary search for optimal growth rate
  let low = 1, high = 10, r = 1;
  for (let i = 0; i < 100; i++) {
    r = (low + high) / 2;
    const sum = geometricSum(r);
    if (Math.abs(sum - targetSum) < 1) break;
    if (sum > targetSum) high = r;
    else low = r;
  }
  
  // Return quota for this specific day (1-indexed)
  return Math.round(start * Math.pow(r, dayNumber - 1));
};

// Generate domain distribution (850-1150 per domain)
const generateDomainDistribution = (totalEmails, numDomains) => {
  const distribution = [];
  let remaining = totalEmails;
  
  for (let i = 0; i < numDomains - 1; i++) {
    const domainsLeft = numDomains - i;
    const avgPerDomain = Math.floor(remaining / domainsLeft);
    
    // Calculate min/max with proper bounds to prevent negative remainder
    const minPerDomain = Math.max(1, Math.floor(avgPerDomain * 0.8));
    const maxPerDomain = Math.min(
      Math.floor(avgPerDomain * 1.2),
      remaining - (domainsLeft - 1) // Ensure at least 1 email for remaining domains
    );
    
    // Ensure min doesn't exceed max
    const actualMin = Math.min(minPerDomain, maxPerDomain);
    const actualMax = Math.max(actualMin, maxPerDomain);
    
    const domainEmails = getRandomInt(actualMin, actualMax);
    distribution.push(domainEmails);
    remaining -= domainEmails;
  }
  
  // Last domain gets remaining emails (guaranteed to be >= 1)
  distribution.push(Math.max(1, remaining));
  return distribution;
};

// Generate email distribution within a domain with better equalization
const generateEmailDistribution = (domainTotal, numEmails, maxEmailPercentage, randomizationIntensity = 0.7) => {
  const distribution = [];
  let remaining = domainTotal;
  
  // Calculate base equal distribution
  const baseEqualShare = Math.floor(domainTotal / numEmails);
  const maxPerEmail = Math.floor(domainTotal * (maxEmailPercentage / 100));
  
  // Adjust randomization based on intensity (0.0 = very balanced, 1.0 = very random)
  const variationFactor = 0.2 + (randomizationIntensity * 0.3); // 0.2 to 0.5
  const maxDeviationFactor = 0.3 + (randomizationIntensity * 0.4); // 0.3 to 0.7
  
  for (let i = 0; i < numEmails - 1; i++) {
    const emailsLeft = numEmails - i;
    
    // Start with base equal share and add controlled randomness
    const baseShare = baseEqualShare;
    
    // Add controlled randomness based on intensity
    const randomVariation = Math.floor(baseShare * variationFactor * (Math.random() - 0.5));
    const adjustedShare = baseShare + randomVariation;
    
    // Ensure we don't exceed max percentage or leave too little for others
    const maxForThisEmail = Math.min(
      maxPerEmail,
      Math.floor(remaining / emailsLeft * (1.3 + randomizationIntensity * 0.2)), // Max deviation based on intensity
      adjustedShare + Math.floor(baseShare * maxDeviationFactor),
      remaining - (emailsLeft - 1) // Ensure at least 1 email for remaining senders
    );
    
    const minForThisEmail = Math.max(
      1,
      Math.floor(remaining / emailsLeft * (0.7 - randomizationIntensity * 0.2)), // Min deviation based on intensity
      adjustedShare - Math.floor(baseShare * maxDeviationFactor)
    );
    
    // Ensure min doesn't exceed max
    const actualMin = Math.min(minForThisEmail, maxForThisEmail);
    const actualMax = Math.max(actualMin, maxForThisEmail);
    
    const emailCount = getRandomInt(actualMin, actualMax);
    distribution.push(emailCount);
    remaining -= emailCount;
  }
  
  // Last email gets remaining (ensures total adds up correctly, guaranteed >= 1)
  distribution.push(Math.max(1, remaining));
  return distribution;
};

// Generate hourly distribution - ADAPTIVE based on email volume
const generateHourlyDistribution = (totalEmails, randomizationIntensity = 0.7) => {
  const hourlyDistribution = new Array(24).fill(0);
  
  // Determine distribution strategy based on email volume
  const isHighVolume = totalEmails > 2000; // High volume threshold
  const isMediumVolume = totalEmails > 500;
  
  let numActiveHours;
  if (isHighVolume) {
    // High volume: Use all 24 hours with varying intensities
    numActiveHours = 24;
  } else if (isMediumVolume) {
    // Medium volume: Use 12-18 hours
    numActiveHours = getRandomInt(12, 18);
  } else {
    // Low volume: Use 4-8 hours (original logic)
    const minActiveHours = Math.max(4, Math.floor(8 - randomizationIntensity * 3));
    const maxActiveHours = Math.min(12, Math.floor(12 - randomizationIntensity * 2));
    numActiveHours = getRandomInt(minActiveHours, maxActiveHours);
  }
  
  // Select active hours
  const activeHours = [];
  if (numActiveHours >= 24) {
    // Use all hours
    for (let i = 0; i < 24; i++) {
      activeHours.push(i);
    }
  } else {
    // Randomly select hours
    while (activeHours.length < numActiveHours) {
      const randomHour = getRandomInt(0, 23);
      if (!activeHours.includes(randomHour)) {
        activeHours.push(randomHour);
      }
    }
  }
  
  // Sort active hours for better distribution
  activeHours.sort((a, b) => a - b);
  
  if (isHighVolume) {
    // High volume: Create natural email flow pattern across all 24 hours
    // Base distribution with natural peaks and valleys
    const baseEmailsPerHour = Math.floor(totalEmails / 24);
    const remainderEmails = totalEmails % 24;
    
    // Start with base distribution
    for (let hour = 0; hour < 24; hour++) {
      hourlyDistribution[hour] = baseEmailsPerHour;
    }
    
    // Distribute remainder emails
    for (let i = 0; i < remainderEmails; i++) {
      const randomHour = i % 24; // Distribute evenly first
      hourlyDistribution[randomHour]++;
    }
    
    // Create natural peaks and valleys (simulate business hours patterns)
    const peakHours = [9, 10, 11, 14, 15, 16]; // Business hours
    const lowHours = [0, 1, 2, 3, 4, 5, 22, 23]; // Night hours
    
    // Redistribute emails to create more natural patterns
    const redistributionAmount = Math.floor(totalEmails * 0.2); // 20% redistribution
    
    for (let i = 0; i < redistributionAmount; i++) {
      const sourceHour = lowHours[getRandomInt(0, lowHours.length - 1)];
      const targetHour = peakHours[getRandomInt(0, peakHours.length - 1)];
      
      if (hourlyDistribution[sourceHour] > Math.floor(baseEmailsPerHour * 0.3)) { // Keep minimum in low hours
        const emailsToMove = getRandomInt(1, 3);
        hourlyDistribution[sourceHour] -= emailsToMove;
        hourlyDistribution[targetHour] += emailsToMove;
      }
    }
    
    // Add final randomization
    const finalRandomization = Math.floor(totalEmails * randomizationIntensity * 0.1);
    for (let i = 0; i < finalRandomization; i++) {
      const sourceHour = getRandomInt(0, 23);
      const targetHour = getRandomInt(0, 23);
      
      if (sourceHour !== targetHour && hourlyDistribution[sourceHour] > 1) {
        hourlyDistribution[sourceHour]--;
        hourlyDistribution[targetHour]++;
      }
    }
    
  } else {
    // Medium/Low volume: Use original concentrated distribution
    const baseEmailsPerHour = Math.floor(totalEmails / numActiveHours);
    const remainderEmails = totalEmails % numActiveHours;
    
    // Distribute base emails to active hours
    activeHours.forEach(hour => {
      hourlyDistribution[hour] = baseEmailsPerHour;
    });
    
    // Distribute remainder emails
    for (let i = 0; i < remainderEmails; i++) {
      const randomActiveHour = activeHours[getRandomInt(0, activeHours.length - 1)];
      hourlyDistribution[randomActiveHour]++;
    }
    
    // Apply randomization
    const redistributionCount = Math.floor(totalEmails * randomizationIntensity * 0.3);
    for (let i = 0; i < redistributionCount; i++) {
      const sourceHour = activeHours[getRandomInt(0, activeHours.length - 1)];
      const targetHour = activeHours[getRandomInt(0, activeHours.length - 1)];
      
      if (sourceHour !== targetHour && hourlyDistribution[sourceHour] > 1) {
        const emailsToMove = getRandomInt(1, Math.min(3, Math.floor(hourlyDistribution[sourceHour] * 0.1)));
        hourlyDistribution[sourceHour] -= emailsToMove;
        hourlyDistribution[targetHour] += emailsToMove;
      }
    }
  }
  
  // Final verification and correction
  const currentSum = hourlyDistribution.reduce((sum, emails) => sum + emails, 0);
  const difference = totalEmails - currentSum;
  
  if (difference !== 0) {
    // Distribute the difference across active hours
    if (difference > 0) {
      // Need to add emails
      for (let i = 0; i < difference; i++) {
        const randomActiveHour = activeHours[i % activeHours.length];
        hourlyDistribution[randomActiveHour]++;
      }
    } else {
      // Need to remove emails
      for (let i = 0; i < Math.abs(difference); i++) {
        const randomActiveHour = activeHours[i % activeHours.length];
        if (hourlyDistribution[randomActiveHour] > 0) {
          hourlyDistribution[randomActiveHour]--;
        }
      }
    }
  }
  
  return hourlyDistribution;
};

// Generate minute-level distribution within an hour
const generateMinuteDistribution = (emailsThisHour) => {
  const minuteDistribution = new Array(60).fill(0);
  
  if (emailsThisHour === 0) return minuteDistribution;
  
  // Base distribution: spread emails across the hour
  const baseEmailsPerMinute = Math.floor(emailsThisHour / 60);
  const remainderEmails = emailsThisHour % 60;
  
  // Distribute base emails to all minutes
  for (let minute = 0; minute < 60; minute++) {
    minuteDistribution[minute] = baseEmailsPerMinute;
  }
  
  // Distribute remainder emails randomly
  for (let i = 0; i < remainderEmails; i++) {
    const randomMinute = getRandomInt(0, 59);
    minuteDistribution[randomMinute]++;
  }
  
  // Add some randomization to make it more natural
  const randomizationCount = Math.floor(emailsThisHour * 0.1); // 10% randomization
  for (let i = 0; i < randomizationCount; i++) {
    const sourceMinute = getRandomInt(0, 59);
    const targetMinute = getRandomInt(0, 59);
    
    if (sourceMinute !== targetMinute && minuteDistribution[sourceMinute] > 0) {
      minuteDistribution[sourceMinute]--;
      minuteDistribution[targetMinute]++;
    }
  }
  
  return minuteDistribution;
};

module.exports = {
  getRandomInt,
  getRandomFloat,
  generateDailyTotal,
  calculateTargetBasedQuota,
  generateDomainDistribution,
  generateEmailDistribution,
  generateHourlyDistribution,
  generateMinuteDistribution
};
