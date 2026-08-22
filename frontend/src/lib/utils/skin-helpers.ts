export interface ProcessedSkinData {
  avgAcne: string;
  avgOil: string;
  avgDry: string;
  skinType: string;
  concerns: string[];
  notesSummary: string[];
  latestPhotoBase64: string;
}

export function isNonSkinImageAlert(analysisText: string): boolean {
  if (!analysisText) return false;
  return (
    analysisText.includes('Image Verification Failed') ||
    analysisText.includes('Non-Skin Image Detected') ||
    analysisText.includes('cannot be performed on non-human') ||
    analysisText.includes('cannot be performed on non-skin')
  );
}

export function processSkinLogsData(skinLogs: any[]): ProcessedSkinData {
  let totalAcne = 0;
  let totalOil = 0;
  let totalDry = 0;
  let latestPhotoBase64 = '';
  let skinType = 'Combination';
  const concernsSet = new Set<string>();
  const notesSummary: string[] = [];

  skinLogs.forEach((log) => {
    totalAcne += Number(log.acne ?? log.condition ?? 5);
    
    let oilVal = 5;
    let dryVal = 2;
    let imgVal = log.image || '';

    try {
      if (log.notes && typeof log.notes === 'string' && log.notes.startsWith('{')) {
        const parsed = JSON.parse(log.notes);
        oilVal = Number(parsed.oiliness ?? 5);
        dryVal = Number(parsed.dryness ?? 2);
        if (parsed.skinType) skinType = parsed.skinType;
        if (Array.isArray(parsed.concerns)) {
          parsed.concerns.forEach((c: string) => concernsSet.add(c));
        }
        if (parsed.text) notesSummary.push(parsed.text);
        if (!imgVal && parsed.photoUrl && parsed.photoUrl.startsWith('data:')) {
          imgVal = parsed.photoUrl;
        }
      } else {
        if (log.notes) notesSummary.push(log.notes);
      }
    } catch {
      if (log.notes) notesSummary.push(log.notes);
    }

    totalOil += Number(log.oiliness ?? oilVal);
    totalDry += Number(log.dryness ?? dryVal);
    if (!latestPhotoBase64 && imgVal && imgVal.startsWith('data:')) {
      latestPhotoBase64 = imgVal;
    }
  });

  const logCount = skinLogs.length || 1;
  return {
    avgAcne: (totalAcne / logCount).toFixed(1),
    avgOil: (totalOil / logCount).toFixed(1),
    avgDry: (totalDry / logCount).toFixed(1),
    skinType,
    concerns: Array.from(concernsSet),
    notesSummary,
    latestPhotoBase64
  };
}

