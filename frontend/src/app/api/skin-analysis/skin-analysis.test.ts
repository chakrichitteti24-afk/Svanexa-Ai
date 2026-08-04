import { describe, it, expect } from 'vitest';
import { processSkinLogsData } from '../../../lib/utils/skin-helpers';

describe('Skin Logs Data Processor', () => {
  it('should handle empty logs list gracefully', () => {
    const result = processSkinLogsData([]);
    expect(result.avgAcne).toBe('0.0');
    expect(result.avgOil).toBe('0.0');
    expect(result.avgDry).toBe('0.0');
    expect(result.notesSummary).toEqual([]);
    expect(result.latestPhotoBase64).toBe('');
  });

  it('should process simple plain-text notes skin logs correctly', () => {
    const logs = [
      { condition: 6, notes: 'Felt a bit stressed today.' },
      { condition: 4, notes: 'Skin is clean!' }
    ];

    const result = processSkinLogsData(logs);
    expect(result.avgAcne).toBe('5.0');
    expect(result.avgOil).toBe('5.0'); // defaults
    expect(result.avgDry).toBe('2.0'); // defaults
    expect(result.notesSummary).toEqual(['Felt a bit stressed today.', 'Skin is clean!']);
    expect(result.latestPhotoBase64).toBe('');
  });

  it('should process complex JSON-structured notes skin logs correctly and extract the latest Base64 photo', () => {
    const logs = [
      { 
        condition: 8, 
        notes: JSON.stringify({ 
          oiliness: 8, 
          dryness: 1, 
          text: 'Acne flare up on forehead.', 
          photoUrl: 'data:image/jpeg;base64,mock1' 
        }) 
      },
      { 
        condition: 4, 
        notes: JSON.stringify({ 
          oiliness: 4, 
          dryness: 3, 
          text: 'Better today.', 
          photoUrl: 'data:image/jpeg;base64,mock2' 
        }) 
      }
    ];

    const result = processSkinLogsData(logs);
    expect(result.avgAcne).toBe('6.0'); // (8+4)/2
    expect(result.avgOil).toBe('6.0');  // (8+4)/2
    expect(result.avgDry).toBe('2.0');  // (1+3)/2
    expect(result.notesSummary).toEqual(['Acne flare up on forehead.', 'Better today.']);
    expect(result.latestPhotoBase64).toBe('data:image/jpeg;base64,mock1'); // takes the latest (first in list)
  });
});
