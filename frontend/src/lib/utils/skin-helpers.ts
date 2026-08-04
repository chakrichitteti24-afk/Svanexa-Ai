export function processSkinLogsData(skinLogs: any[]) {
  let totalAcne = 0;
  let totalOil = 0;
  let totalDry = 0;
  let latestPhotoBase64 = '';
  const notesSummary: string[] = [];

  skinLogs.forEach((log) => {
    totalAcne += Number(log.acne ?? log.condition ?? 5);
    
    let oilVal = 5;
    let dryVal = 2;
    let imgVal = log.image || '';

    try {
      if (log.notes && log.notes.startsWith('{')) {
        const parsed = JSON.parse(log.notes);
        oilVal = Number(parsed.oiliness ?? 5);
        dryVal = Number(parsed.dryness ?? 2);
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
    notesSummary,
    latestPhotoBase64
  };
}
