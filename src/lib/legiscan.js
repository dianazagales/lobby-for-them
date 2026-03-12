const LEGISCAN_BASE = 'https://api.legiscan.com/';
const API_KEY = import.meta.env.VITE_LEGISCAN_API_KEY;

export async function getBill(billId) {
  if (!API_KEY) {
    console.warn('LegiScan API key not configured');
    return null;
  }
  try {
    const url = `${LEGISCAN_BASE}?key=${API_KEY}&op=getBill&id=${billId}`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.status === 'OK') {
      return data.bill;
    }
    return null;
  } catch (err) {
    console.error('LegiScan getBill error:', err);
    return null;
  }
}

export async function searchBills(query) {
  if (!API_KEY) {
    console.warn('LegiScan API key not configured');
    return [];
  }
  try {
    const url = `${LEGISCAN_BASE}?key=${API_KEY}&op=getSearch&query=${encodeURIComponent(query)}&state=ALL`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.status === 'OK' && data.searchresult) {
      // Remove the summary key, keep only numeric keys (bill results)
      return Object.values(data.searchresult).filter(item => item.bill_id);
    }
    return [];
  } catch (err) {
    console.error('LegiScan search error:', err);
    return [];
  }
}

export function formatBillStatus(statusId) {
  const statuses = {
    1: 'Introduced',
    2: 'Engrossed',
    3: 'Enrolled',
    4: 'Passed',
    5: 'Vetoed',
    6: 'Failed/Dead',
    7: 'Override',
    8: 'Chaptered',
    9: 'Refer',
    10: 'Report Pass',
    11: 'Report DNP',
    12: 'Draft',
  };
  return statuses[statusId] || 'Unknown';
}
