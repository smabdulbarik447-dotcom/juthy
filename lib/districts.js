// Thikana theke jela ber kora (dashboard er জেলা লিডারবোর্ড) — bangla/english duitai, bhinno banan soho
const LIST = [
  ["ঢাকা", "ঢাকা", "dhaka"], ["গাজীপুর", "গাজীপুর", "গাজিপুর", "gazipur"], ["নারায়ণগঞ্জ", "নারায়ণগঞ্জ", "নারায়নগঞ্জ", "narayanganj"],
  ["নরসিংদী", "নরসিংদী", "নরসিংদি", "narsingdi"], ["মুন্সীগঞ্জ", "মুন্সীগঞ্জ", "মুন্সিগঞ্জ", "munshiganj"], ["মানিকগঞ্জ", "মানিকগঞ্জ", "manikganj"],
  ["টাঙ্গাইল", "টাঙ্গাইল", "টাংগাইল", "tangail"], ["কিশোরগঞ্জ", "কিশোরগঞ্জ", "kishoreganj", "kishorganj"], ["ফরিদপুর", "ফরিদপুর", "faridpur"],
  ["গোপালগঞ্জ", "গোপালগঞ্জ", "gopalganj"], ["মাদারীপুর", "মাদারীপুর", "মাদারিপুর", "madaripur"], ["শরীয়তপুর", "শরীয়তপুর", "শরিয়তপুর", "shariatpur"],
  ["রাজবাড়ী", "রাজবাড়ী", "রাজবাড়ি", "rajbari"], ["চট্টগ্রাম", "চট্টগ্রাম", "চট্রগ্রাম", "chattogram", "chittagong", "ctg"],
  ["কক্সবাজার", "কক্সবাজার", "cox"], ["কুমিল্লা", "কুমিল্লা", "cumilla", "comilla"], ["ফেনী", "ফেনী", "ফেনি", "feni"],
  ["নোয়াখালী", "নোয়াখালী", "নোয়াখালি", "noakhali"], ["লক্ষ্মীপুর", "লক্ষ্মীপুর", "লক্ষীপুর", "lakshmipur", "laxmipur"],
  ["চাঁদপুর", "চাঁদপুর", "চাদপুর", "chandpur"], ["ব্রাহ্মণবাড়িয়া", "ব্রাহ্মণবাড়িয়া", "বি-বাড়িয়া", "বিবাড়িয়া", "brahmanbaria"],
  ["রাঙ্গামাটি", "রাঙ্গামাটি", "রাঙামাটি", "rangamati"], ["খাগড়াছড়ি", "খাগড়াছড়ি", "khagrachari", "khagrachhari"], ["বান্দরবান", "বান্দরবান", "bandarban"],
  ["রাজশাহী", "রাজশাহী", "রাজশাহি", "rajshahi"], ["নাটোর", "নাটোর", "natore"], ["নওগাঁ", "নওগাঁ", "নওগা", "naogaon"],
  ["চাঁপাইনবাবগঞ্জ", "চাঁপাইনবাবগঞ্জ", "চাপাইনবাবগঞ্জ", "চাঁপাই", "chapai"], ["পাবনা", "পাবনা", "pabna"], ["সিরাজগঞ্জ", "সিরাজগঞ্জ", "sirajganj"],
  ["বগুড়া", "বগুড়া", "বগুরা", "bogura", "bogra"], ["জয়পুরহাট", "জয়পুরহাট", "joypurhat", "jaipurhat"], ["খুলনা", "খুলনা", "khulna"],
  ["যশোর", "যশোর", "jessore", "jashore"], ["সাতক্ষীরা", "সাতক্ষীরা", "satkhira"], ["বাগেরহাট", "বাগেরহাট", "bagerhat"],
  ["নড়াইল", "নড়াইল", "narail"], ["মাগুরা", "মাগুরা", "magura"], ["ঝিনাইদহ", "ঝিনাইদহ", "jhenaidah", "jhenidah"],
  ["কুষ্টিয়া", "কুষ্টিয়া", "kushtia"], ["চুয়াডাঙ্গা", "চুয়াডাঙ্গা", "chuadanga"], ["মেহেরপুর", "মেহেরপুর", "meherpur"],
  ["বরিশাল", "বরিশাল", "barishal", "barisal"], ["পটুয়াখালী", "পটুয়াখালী", "patuakhali"], ["ভোলা", "ভোলা", "bhola"],
  ["পিরোজপুর", "পিরোজপুর", "pirojpur"], ["ঝালকাঠি", "ঝালকাঠি", "ঝালকাঠী", "jhalokati", "jhalakathi"], ["বরগুনা", "বরগুনা", "barguna"],
  ["সিলেট", "সিলেট", "sylhet"], ["মৌলভীবাজার", "মৌলভীবাজার", "মৌলভিবাজার", "moulvibazar"], ["হবিগঞ্জ", "হবিগঞ্জ", "habiganj"],
  ["সুনামগঞ্জ", "সুনামগঞ্জ", "sunamganj"], ["রংপুর", "রংপুর", "rangpur"], ["দিনাজপুর", "দিনাজপুর", "dinajpur"],
  ["গাইবান্ধা", "গাইবান্ধা", "gaibandha"], ["কুড়িগ্রাম", "কুড়িগ্রাম", "kurigram"], ["লালমনিরহাট", "লালমনিরহাট", "lalmonirhat"],
  ["নীলফামারী", "নীলফামারী", "নীলফামারি", "nilphamari"], ["পঞ্চগড়", "পঞ্চগড়", "panchagarh"], ["ঠাকুরগাঁও", "ঠাকুরগাঁও", "ঠাকুরগাও", "thakurgaon"],
  ["ময়মনসিংহ", "ময়মনসিংহ", "মোমেনশাহী", "mymensingh"], ["জামালপুর", "জামালপুর", "jamalpur"], ["নেত্রকোনা", "নেত্রকোনা", "netrokona", "netrakona"],
  ["শেরপুর", "শেরপুর", "sherpur"],
];
// Jela na likhe shudhu elaka likhle (Dhaka shohorer porichito jayga)
const DHAKA_AREAS = ["মিরপুর", "উত্তরা", "মোহাম্মদপুর", "ধানমন্ডি", "বাড্ডা", "গুলশান", "যাত্রাবাড়ী", "মতিঝিল", "সাভার", "কেরানীগঞ্জ", "খিলগাঁও", "রামপুরা", "মালিবাগ", "বনানী", "তেজগাঁও",
  "mirpur", "uttara", "mohammadpur", "dhanmondi", "badda", "gulshan", "jatrabari", "motijheel", "savar", "keraniganj", "khilgaon", "rampura", "banani"];

const norm = (s) => String(s || "").normalize("NFC").toLowerCase();
const KEYS = LIST.map(([name, ...keys]) => [name, keys.map(norm)]);
const DHAKA = DHAKA_AREAS.map(norm);

/** Thikana theke jela (thikana sadharonoto choto → boro, tai shobcheye pichoner mil ta nei); na pele area diye bujhi */
export function districtOf(address, area) {
  const a = norm(address);
  let best = null;
  let at = -1;
  for (const [name, keys] of KEYS) {
    for (const k of keys) {
      const i = a.lastIndexOf(k);
      if (i > at) { at = i; best = name; }
    }
  }
  if (best) return best;
  if (area === "inside" || DHAKA.some((k) => a.includes(k))) return "ঢাকা";
  return null;
}
