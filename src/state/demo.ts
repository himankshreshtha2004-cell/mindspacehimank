import type { AppData, Edge, Group, MNode, NodeType, Relation, Workspace } from "./types";

let seq = 0;
export const uid = (p = "n") => `${p}_${Date.now().toString(36)}${(seq++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const DAY = 86400000;
const HOUR = 3600000;

/* --------------------------------------------------------------------------
   The sample data is written as if one person has been using Mindspace for
   about a year: their dream life, a career switch into product design, money,
   Japan, family, fitness — and a second space for random stuff.
   Dates are relative to "now", so it always looks about a year old.
   -------------------------------------------------------------------------- */

type St = "done" | "progress" | "pending";
type Spec = {
  key: string; type: NodeType; title: string; description: string; notes?: string;
  x: number; y: number; size?: MNode["size"]; priority?: MNode["priority"];
  done?: boolean; due?: number; progress?: number; from?: NodeType;
  items?: [string, St][]; links?: [string, string][];
  age: number; touched?: number; // days ago: created / last updated
  inbox?: boolean; archived?: boolean;
};

function build(name: string, ageDays: number, now: number, specs: Spec[], rels: [string, string, Relation, number?][], groups: [string, string, string[]][]): Workspace {
  const ids: Record<string, string> = {};
  const nodes: MNode[] = specs.map((s) => {
    const id = uid("n");
    ids[s.key] = id;
    const created = now - s.age * DAY - ((s.age * 7) % 11) * HOUR;
    const updated = now - (s.touched ?? Math.max(0, Math.round(s.age * 0.35))) * DAY - ((s.age * 5) % 9) * HOUR;
    return {
      id, type: s.type, title: s.title, description: s.description, notes: s.notes || "", x: s.x, y: s.y,
      size: s.size || "sm", priority: s.priority || "medium", progress: s.progress, done: s.done,
      due: s.due !== undefined ? new Date(now + s.due * DAY).toISOString().slice(0, 10) : undefined,
      items: (s.items || []).map(([text, st]) => ({ id: uid("c"), text, done: st === "done", status: st })),
      links: (s.links || []).map(([label, url]) => ({ label, url })),
      createdAt: created, updatedAt: Math.max(created, updated), convertedFrom: s.from, inbox: s.inbox, archived: s.archived,
    };
  });
  const edges: Edge[] = rels.map(([a, b, rel, age]) => ({ id: uid("e"), from: ids[a], to: ids[b], rel, createdAt: now - (age ?? 200) * DAY }));
  const gs: Group[] = groups.map(([gname, color, keys]) => ({ id: uid("g"), name: gname, color, nodeIds: keys.map((k) => ids[k]) }));
  return { id: uid("w"), name, nodes, edges, groups: gs, createdAt: now - ageDays * DAY, updatedAt: now - 2 * HOUR };
}

/* ========================================================================== main space */
export function makeDemo(now = Date.now()): Workspace {
  const S: Spec[] = [
    { key: "core", type: "goal", size: "xl", title: "My Dream Life", priority: "high", x: 0, y: 0, age: 364, touched: 3,
      description: "Sab yahin se start hota hai. 2027 tak ka plan: kisi achhe startup mein Product Designer, apna khud ka flat, Japan trip done, aur body bhi fit rahe. Ye map ek saal pehle banaya tha jab sab sirf dimaag mein ghoom raha tha — ab kam se kam dikhta toh hai.",
      notes: "Har Sunday raat 15 min ka review: kya hua, kya nahi hua, next week kya.\nAgar 2 hafte review skip hua toh samajh lena kuch gadbad hai.\n\nNov '26 update: saal bhar mein jitna socha tha usse zyada hua hai, bas career wala part slow hai. Wahi focus.",
      links: [["Sunday review template", "https://example.com/weekly-review"]] },

    // ---- career (upper left)
    { key: "career", type: "project", size: "lg", title: "Switch to Product Design", priority: "high", x: -330, y: -120, age: 360, touched: 2,
      description: "Current job se product design mein shift karna hai. Target: kisi startup mein Product Designer — fintech ya consumer app ho toh best. Job chhodne se pehle portfolio aur 2-3 interviews ready hone chahiye.",
      notes: "Roz minimum 1 ghanta, weekends pe 4-5 ghante. Office se aake thakaan hoti hai, pata hai, phir bhi.\nMarch mein lagta tha 6 mahine mein ho jayega. Lol. Realistic deadline: March 2027.",
      items: [["Google UX certificate", "done"], ["Learn Figma properly (auto layout, variables)", "done"], ["Mentor dhundo", "progress"]] },
    { key: "figma", type: "task", title: "Figma daily practice", priority: "medium", x: -612, y: -52, age: 290, touched: 1, due: 45,
      description: "Roz ek screen redesign — apps jo main roz use karta hoon (Zomato, CRED, Spotify). Day 63/100 chal raha hai.",
      notes: "Streak 2 baar toot chuka hai (Diwali + bimaar tha). Restart nahi kiya, bas continue. Best screens Dribbble pe daalni hain.",
      items: [["Days 1–30", "done"], ["Days 31–60", "done"], ["Days 61–100", "progress"]] },
    { key: "portfolio", type: "project", size: "md", title: "Portfolio website", priority: "high", x: -600, y: -172, age: 240, touched: 1,
      description: "3 solid case studies, bas. Fancy animations se zyada process clear dikhna chahiye — problem, research, iterations, final. Netlify pe live.",
      notes: "Feedback from senior designer (call pe): 'outcomes dikhao, sirf screens nahi'. Har case study mein ek 'what changed' section add karna hai.",
      items: [["Krishi Dharohar kiosk case study", "done"], ["Mindspace case study", "done"], ["Third case study — fintech app concept", "progress"], ["Copy + final polish", "pending"], ["Launch + share on LinkedIn", "pending"]],
      links: [["Live portfolio", "https://example.com/portfolio"], ["Case study structure notes", "https://example.com/case-study-notes"]] },
    { key: "apply", type: "task", title: "Startup applications", priority: "high", x: -468, y: -292, age: 75, touched: 4, due: 30,
      description: "20 startups ki list — fintech, edtech, D2C. Cold apply se zyada referrals pe focus.",
      notes: "Ab tak 6 applications, 1 assignment round mila (cleared nahi hua, par feedback achha tha). Next: referral maango, LinkedIn pe log approachable hain.",
      items: [["List of 20 startups", "done"], ["Referrals maango (5)", "progress"], ["10 applications bhejo", "progress"], ["Mock interview with friend", "pending"]] },

    // ---- Japan (top)
    { key: "japan", type: "inspiration", size: "lg", title: "Japan Trip", priority: "medium", x: 0, y: -235, age: 330, touched: 9,
      description: "Bachpan se ka sapna. Spring 2027 — cherry blossom season, 12-14 din. Tokyo, Kyoto, Osaka. Design, anime, khana — sab.",
      notes: "Akele jaana hai ya gang ke saath? Abhi decide nahi. Budget around ₹2.5L incl. flights.",
      links: [["Japan rail pass info", "https://example.com/jr-pass"]] },
    { key: "tokyo", type: "inspiration", title: "Tokyo design walk", x: -236, y: -362, age: 210, touched: 40,
      description: "Shibuya crossing, Daikanyama T-Site, 21_21 Design Sight, Ginza ke stores. Signage aur wayfinding live dekhna hai — itna clean kaise rakhte hain.",
      notes: "Muji ka flagship store bhi. Notebook leke jaana, sketches banane hain." },
    { key: "kyoto", type: "thought", title: "Kyoto + anime spots", x: 0, y: -392, age: 180, touched: 60,
      description: "Fushimi Inari subah 6 baje (bheed se pehle). Your Name wali stairs (Suga Shrine) — ek photo toh banti hai. Akihabara ek poora din.",
      notes: "Ghibli Museum tickets 1 mahina pehle khulte hain — reminder lagana." },
    { key: "jfund", type: "task", title: "Japan fund", priority: "medium", x: 236, y: -362, age: 150, touched: 12, due: 120,
      description: "Separate RD — har mahine ₹8k. Flights + JR pass + stay.",
      items: [["RD khola", "done"], ["₹1L tak", "done"], ["₹2L tak", "progress"], ["Visa documents ready", "pending"]] },

    // ---- fitness (upper right)
    { key: "fitness", type: "goal", size: "lg", title: "Fitness & Sports", priority: "high", x: 330, y: -120, age: 340, touched: 5,
      description: "Gym boring lagta hai, isliye sports. Bas active rehna hai — haftay mein 4 din kuch na kuch khelna ya chalana.",
      notes: "Office chair pe 9 ghante = kamar ki band. Back pain dobara nahi chahiye." },
    { key: "badminton", type: "task", title: "Badminton 3x a week", priority: "high", x: 602, y: -172, age: 260, touched: 2,
      description: "Tue/Thu/Sat, society court pe 7–8 baje. Doubles mein smash improve karna hai.",
      notes: "Is mahine 9/12 sessions. Not bad.",
      items: [["Racket restring", "done"], ["Club membership renew", "done"], ["4 weeks bina skip", "progress"]] },
    { key: "cycling", type: "task", title: "Sunday cycling 20km", priority: "medium", x: 612, y: -52, age: 200, touched: 8,
      description: "Sunday subah 6:30 — India Gate round. Pichhle mahine sirf 3 baar gaya, sardi mein aur mushkil hoga.",
      items: [["Helmet + lights", "done"], ["4 Sundays in a row", "progress"]] },
    { key: "sleep", type: "thought", title: "Sleep before 12:30", priority: "medium", x: 468, y: -292, age: 120, touched: 6,
      description: "Raat ko reels band. Phone charger doosre room mein. Subah fresh feel hota hai jab bhi ho paata hai.",
      notes: "Weekends pe toot jaata hai. Kam se kam weekdays." },

    // ---- money (lower right)
    { key: "money", type: "goal", size: "lg", title: "Move Out Fund", priority: "high", x: 330, y: 120, age: 300, touched: 4,
      description: "Apna khud ka 1BHK, office ke paas. Ghar se door nahi, bas apni space. Pehle 6 months ka buffer, phir shift.",
      notes: "Mummy ko abhi properly bataya nahi hai. Pehle paise ready, phir baat. Target: mid 2027." },
    { key: "efund", type: "task", title: "Emergency fund", priority: "high", x: 604, y: 62, age: 280, touched: 3, due: 180,
      description: "Rent + kharche ka 6 mahine ka buffer, liquid fund mein.",
      items: [["Separate account", "done"], ["Auto-transfer on salary day", "done"], ["3 months reached", "done"], ["6 months", "progress"]] },
    { key: "sip", type: "task", title: "SIP ₹5k/month", priority: "medium", done: true, x: 612, y: 180, age: 250, touched: 70,
      description: "Index fund SIP start kar diya. Kabhi band nahi karna, market gire tab bhi.",
      notes: "Har saal April mein 10% badhana hai." },
    { key: "flat", type: "thought", title: "Flat hunting notes", priority: "low", x: 470, y: 300, age: 90, touched: 15,
      description: "Budget 18–22k rent. Office se 30 min ke andar. Balcony + natural light must. Broker se bachna hai, NoBroker pe dekhte rehna.",
      notes: "Ek baar weekend pe 3 flats dekh ke aaye — sab ya toh chhote the ya mehnge. Patience." },

    // ---- family & friends (bottom)
    { key: "people", type: "thought", size: "lg", title: "Family & Friends", priority: "high", x: 0, y: 235, age: 320, touched: 7,
      description: "Kaam aur goals ke chakkar mein inko ignore nahi karna. Ye list isliye hai taaki yaad rahe.",
      notes: "Mummy-Papa ke saath har Sunday dinner, phone side mein." },
    { key: "goa", type: "task", title: "Parents ka Goa trip", priority: "high", x: -240, y: 372, age: 60, touched: 5, due: 95,
      description: "Mummy-Papa kabhi Goa nahi gaye. Feb mein — sab main book karunga, surprise.",
      items: [["Dates fix (Papa ki chhutti)", "done"], ["Flights book", "pending"], ["Stay — North Goa, calm wala", "pending"]] },
    { key: "wedding", type: "thought", title: "Cousin ki shaadi — Dec", x: 0, y: 402, age: 45, touched: 2,
      description: "Sangeet ke liye dance practice (ugh). Outfit abhi tak decide nahi hua. Gift: sab cousins milke.",
      notes: "Leave apply karna hai — 3 din." },
    { key: "gang", type: "task", title: "Gang meetup – monthly", done: true, x: 240, y: 372, age: 230, touched: 11,
      description: "College gang ka monthly meetup. Last wala Hauz Khas pe tha, next Kabir ke ghar.",
      notes: "Ananya ka birthday 3 Dec — cake wala kaam mera." },

    // ---- random dimaag (lower left)
    { key: "random", type: "thought", size: "lg", title: "Random Dimaag", priority: "low", x: -330, y: 120, age: 310, touched: 1,
      description: "Music, games, shows — jo bhi dimaag mein ghoomta rehta hai. Details ke liye alag space bhi bana diya hai.",
      notes: "Ye bhi zaroori hai. Sab kuch productive nahi hona chahiye." },
    { key: "guitar", type: "task", title: "Guitar – 10 songs", priority: "low", x: -610, y: 62, age: 270, touched: 6,
      description: "YouTube se seekh raha hoon. Goal: 10 songs bina dekhe bajana.",
      notes: "Barre chords se nafrat hai. Ungliyan dukh rahi hain, matlab progress ho rahi hai (shayad).",
      items: [["Basic chords G C D Em", "done"], ["Tum Hi Ho", "done"], ["Wonderwall", "done"], ["Iktara", "progress"], ["Barre chords", "pending"]] },
    { key: "watch", type: "inspiration", title: "Watchlist", x: -602, y: 180, age: 300, touched: 3,
      description: "Abhi: Jujutsu Kaisen, Dark (rewatch), Panchayat. Next: The Bear S3, Frieren. Done is saal: Breaking Bad, Kota Factory, Your Name (3rd time).",
      notes: "Anime ke UI/title cards se bahut ideas aate hain — screenshots ek folder mein save kar raha hoon." },
    { key: "pc", type: "thought", title: "Gaming PC someday", priority: "low", x: -470, y: 300, age: 160, touched: 30,
      description: "Valorant + GTA ke liye proper rig. Par pehle flat, phir PC. Priorities bro.",
      notes: "Rough budget ₹90k. Tab tak laptop pe low settings." },

    // ---- inbox (captured, not yet placed)
    { key: "i1", type: "thought", title: "App idea: chai bill splitter", inbox: true, x: 0, y: 0, age: 3, touched: 3,
      description: "Office mein roz ka chai/snacks ka hisaab — ek super simple splitter. 3am wala idea." },
    { key: "i2", type: "task", title: "Dribbble pe pehla shot daalo", inbox: true, x: 0, y: 0, age: 6, touched: 6, description: "" },
    { key: "i3", type: "thought", title: "Mechanical keyboard (budget wala)", inbox: true, x: 0, y: 0, age: 11, touched: 11, description: "Keychron ya local brand? ₹5k ke andar." },
    { key: "i4", type: "task", title: "Mummy ka phone change karwana", inbox: true, x: 0, y: 0, age: 1, touched: 1, description: "Storage full ka error roz aata hai." },

    // ---- archived ideas
    { key: "a1", type: "thought", title: "MBA karun?", archived: true, x: -760, y: -330, age: 350, touched: 280, description: "Socha tha. Nahi — design hi karna hai. Decision done." },
    { key: "a2", type: "inspiration", title: "Learn 3D in Blender", archived: true, x: 760, y: 330, age: 220, touched: 150, description: "Cool hai par abhi focus nahi. Portfolio ke baad dekhenge." },
    { key: "a3", type: "task", title: "Insta theme page", archived: true, x: -760, y: 330, age: 330, touched: 300, description: "2 hafte chala. Time waste tha, career pe lagao." },
  ];
  const R: [string, string, Relation, number?][] = [
    ["career", "core", "partof", 360], ["japan", "core", "partof", 330], ["fitness", "core", "partof", 340],
    ["money", "core", "partof", 300], ["people", "core", "partof", 320], ["random", "core", "related", 310],
    ["figma", "career", "partof", 290], ["portfolio", "career", "partof", 240], ["apply", "career", "partof", 75],
    ["tokyo", "japan", "inspired", 210], ["kyoto", "japan", "related", 180], ["jfund", "japan", "partof", 150],
    ["badminton", "fitness", "partof", 260], ["cycling", "fitness", "partof", 200], ["sleep", "fitness", "related", 120],
    ["efund", "money", "partof", 280], ["sip", "money", "partof", 250], ["flat", "money", "related", 90],
    ["goa", "people", "partof", 60], ["wedding", "people", "related", 45], ["gang", "people", "partof", 230],
    ["guitar", "random", "partof", 270], ["watch", "random", "inspired", 300], ["pc", "random", "related", 160],
    // cross-links that grew over the year
    ["portfolio", "apply", "leads", 70], ["tokyo", "portfolio", "inspired", 100], ["jfund", "efund", "depends", 140],
  ];
  return build("My Dream Life", 364, now, S, R, [
    ["Weekly routine", "#22D3EE", ["badminton", "cycling", "sleep"]],
  ]);
}

/* ========================================================================== second space: random stuff */
export function makeRandomSpace(now = Date.now()): Workspace {
  const S: Spec[] = [
    { key: "core", type: "thought", size: "xl", title: "Random Dimaag", x: 0, y: 0, age: 240, touched: 1,
      description: "Jo bhi dimaag mein aata hai, yahan daal deta hoon. Shows, songs, games, 3am app ideas. No judgement zone.",
      notes: "Main space clean rehta hai, saara kachra yahan :)" },
    { key: "shows", type: "inspiration", size: "lg", title: "Shows & Anime", x: -330, y: -120, age: 238, touched: 3,
      description: "Jo dekh raha hoon, jo dekhna hai, aur jo dobara dekhna hai." },
    { key: "music", type: "thought", size: "lg", title: "Music", x: 330, y: -120, age: 230, touched: 5,
      description: "Kaam ke liye lo-fi, badminton ke baad Punjabi, raat ko Arijit. Mood ke hisaab se." },
    { key: "games", type: "thought", size: "lg", title: "Gaming", x: 330, y: 120, age: 225, touched: 9,
      description: "Weekend pe gang ke saath Valorant. Story games akele." },
    { key: "ideas", type: "project", size: "lg", title: "App ideas", x: -330, y: 120, age: 200, touched: 2,
      description: "Side project ideas — inmein se ek portfolio ka third case study ban sakta hai.",
      items: [["Shortlist 3 ideas", "done"], ["Pick one for case study", "progress"]] },

    { key: "jjk", type: "task", title: "Jujutsu Kaisen S2", done: true, x: -612, y: -52, age: 120, touched: 30, description: "Shibuya arc — animation insane tha. Title cards ka typography note kiya." },
    { key: "dark", type: "task", title: "Dark — rewatch", x: -600, y: -172, age: 60, touched: 4, description: "Is baar family tree bana ke dekh raha hoon. Season 2 pe hoon.", items: [["S1", "done"], ["S2", "progress"], ["S3", "pending"]] },
    { key: "panch", type: "inspiration", title: "Panchayat", x: -468, y: -292, age: 150, touched: 50, description: "Comfort show. Sachiv ji supremacy. Next season ka wait." },

    { key: "lofi", type: "inspiration", title: "Lo-fi work playlist", x: 602, y: -172, age: 210, touched: 6, description: "Figma practice ke time sirf ye. 4 ghante ka loop.", links: [["Playlist", "https://example.com/lofi"]] },
    { key: "concert", type: "task", title: "Concert this winter", x: 612, y: -52, age: 40, touched: 7, due: 40, description: "Lollapalooza ya koi local indie gig — gang ko poochna hai.", items: [["Dates check", "done"], ["Tickets", "pending"]] },
    { key: "arijit", type: "thought", title: "Late night Arijit", x: 468, y: -292, age: 180, touched: 20, description: "Raat 1 baje wala mood. Sleep goal ka dushman." },

    { key: "valo", type: "task", title: "Valorant — Gold tak", x: 604, y: 62, age: 190, touched: 5, description: "Silver 3 pe atka hoon 2 mahine se. Aim lab daily 15 min.", items: [["Silver 3", "done"], ["Gold 1", "progress"]] },
    { key: "gta", type: "thought", title: "GTA 6 kab aayega", x: 612, y: 180, age: 300, touched: 90, description: "Trailer 12 baar dekh liya. PC version ke liye toh aur wait." },
    { key: "story", type: "inspiration", title: "Story games list", x: 470, y: 300, age: 140, touched: 25, description: "Ghost of Tsushima (Japan vibes!), It Takes Two (bhai ke saath), Hades." },

    { key: "chai", type: "thought", title: "Chai bill splitter", x: -470, y: 300, age: 30, touched: 3, description: "Office group ke liye — har din ka hisaab, month end pe settle. Super simple UI.", notes: "Splitwise heavy lagta hai is kaam ke liye." },
    { key: "habit", type: "thought", title: "Habit tracker for sports", x: -610, y: 62, age: 80, touched: 15, description: "Badminton + cycling streaks, friends ke saath compare. Thoda gamified." },
    { key: "watchparty", type: "thought", title: "Anime watch-party app", x: -602, y: 180, age: 110, touched: 40, description: "Sync playback + reactions. Pata hai already exist karta hai, par UI sab ka bura hai." },
  ];
  const R: [string, string, Relation, number?][] = [
    ["shows", "core", "partof", 238], ["music", "core", "partof", 230], ["games", "core", "partof", 225], ["ideas", "core", "partof", 200],
    ["jjk", "shows", "partof", 120], ["dark", "shows", "partof", 60], ["panch", "shows", "inspired", 150],
    ["lofi", "music", "inspired", 210], ["concert", "music", "partof", 40], ["arijit", "music", "related", 180],
    ["valo", "games", "partof", 190], ["gta", "games", "related", 300], ["story", "games", "inspired", 140],
    ["chai", "ideas", "partof", 30], ["habit", "ideas", "partof", 80], ["watchparty", "ideas", "partof", 110],
    ["watchparty", "jjk", "inspired", 100], ["story", "shows", "related", 120],
  ];
  return build("Random Dimaag", 240, now, S, R, [["Watch queue", "#C4B5FD", ["jjk", "dark", "panch"]]]);
}

/** a year of activity so the notification list feels lived-in */
export function demoActivity(now = Date.now()): AppData["activity"] {
  const A: [number, string, string][] = [
    [0.08, "Updated “Figma daily practice” — day 63", "info"],
    [1, "Added “Mummy ka phone change karwana” to Inbox", "create"],
    [2, "Completed “Mindspace case study” in “Portfolio website”", "done"],
    [3, "Captured “App idea: chai bill splitter”", "create"],
    [4, "Edited notes on “Startup applications”", "info"],
    [9, "Completed task “Gang meetup – monthly”", "done"],
    [12, "Moved ₹2L milestone to in progress in “Japan fund”", "info"],
    [45, "Created “Cousin ki shaadi — Dec”", "create"],
    [60, "Created “Parents ka Goa trip”", "create"],
    [70, "Connected “Portfolio website” → “Startup applications”", "connect"],
    [75, "Created “Startup applications”", "create"],
    [150, "Archived “Learn 3D in Blender”", "archive"],
    [240, "Created space “Random Dimaag”", "space"],
    [280, "Archived “MBA karun?”", "archive"],
    [364, "Created space “My Dream Life”", "space"],
  ];
  return A.map(([d, text, kind]) => ({ id: uid("a"), text, at: now - d * DAY, kind }));
}

export function blankWorkspace(name = "Untitled space"): Workspace {
  const now = Date.now();
  return {
    id: uid("w"), name, edges: [], groups: [], createdAt: now, updatedAt: now,
    nodes: [{ id: uid("n"), type: "goal", size: "xl", title: name, description: "The centre of this space. Click anywhere on the canvas to add your first thought.", notes: "", x: 0, y: 0, priority: "medium", items: [], links: [], createdAt: now, updatedAt: now }],
  };
}
