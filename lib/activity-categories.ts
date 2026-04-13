export type Category = {
  name: string
  color: string
  keywords: string[]
}

export const DEFAULT_CATEGORIES: Category[] = [
  {
    name: "Adventure",
    color: "#F28B82",
    keywords: [
      "surf", "hike", "hiking", "kayak", "zipline", "rappel", "climb", "climbing",
      "bike", "biking", "cycle", "cycling", "ski", "skiing", "snowboard", "scuba",
      "dive", "diving", "snorkel", "snorkeling", "paraglide", "paragliding", "raft",
      "rafting", "bungee", "skydive", "atv", "quad", "jeep", "cenote", "cave",
      "caving", "waterfall", "trek", "trekking", "trail", "expedition", "excursion",
      "adventure", "safari", "zip line", "abseil", "canoe", "canoeing", "paddleboard",
      "paddle board", "sup", "horseback", "surfing", "lesson", "rock climbing",
      "obstacle", "escape room", "go kart", "go-kart", "racing",
    ],
  },
  {
    name: "Cultural",
    color: "#FDD663",
    keywords: [
      "museum", "gallery", "art", "temple", "church", "cathedral", "mosque", "ruins",
      "historic", "monument", "tour", "guided tour", "market", "bazaar", "souk",
      "festival", "show", "performance", "concert", "theater", "theatre", "opera",
      "exhibit", "exhibition", "palace", "castle", "fort", "fortress", "heritage",
      "cultural", "cooking class", "pottery", "workshop", "local", "traditional",
      "cemetery", "architecture", "street art", "murals", "landmarks",
    ],
  },
  {
    name: "Food",
    color: "#81C995",
    keywords: [
      "lunch", "dinner", "breakfast", "brunch", "meal", "eat", "eating", "restaurant",
      "tacos", "sushi", "pizza", "ramen", "bbq", "barbecue", "seafood", "cafe",
      "coffee", "drinks", "bar", "cocktail", "cocktails", "wine", "beer", "brewery",
      "winery", "happy hour", "tasting", "food tour", "street food", "snack", "snacks",
      "gelato", "ice cream", "dessert", "bakery", "tapas", "reservation", "dining",
      "brunch", "buffet", "foodie", "rooftop bar", "nightlife",
    ],
  },
  {
    name: "Leisure",
    color: "#78D9EC",
    keywords: [
      "pool", "beach", "spa", "massage", "relax", "relaxing", "sunset", "sunrise",
      "swim", "swimming", "sunbathe", "hot spring", "onsen", "hammam", "sauna",
      "stroll", "walk", "walking", "wander", "explore", "exploring", "shopping",
      "shop", "boardwalk", "promenade", "park", "garden", "picnic", "leisure",
      "chill", "lounge", "free time", "boat", "boating", "cruise", "sail", "sailing",
    ],
  },
  {
    name: "Busy",
    color: "#EE675C",
    keywords: [
      "work", "working", "meeting", "call", "zoom", "conference", "busy",
      "unavailable", "blocked", "office", "remote", "wfh", "work from home",
      "client", "deadline", "heads down",
    ],
  },
  {
    name: "Transit",
    color: "#AECBF8",
    keywords: [
      "flight", "fly", "flying", "airport", "ferry", "ferrying", "train", "rail",
      "bus", "drive", "driving", "road trip", "transfer", "depart", "departure",
      "arrive", "arrival", "check-in", "check in", "checkout", "check out",
      "airbnb", "hotel", "hostel", "transit", "commute", "uber", "taxi", "lyft",
      "boat ride", "shuttle", "pickup", "drop off",
    ],
  },
]

/**
 * Returns the first category whose keywords match the given title, or null if none match.
 * Matching is case-insensitive and substring-based.
 */
export function suggestCategory(title: string): Category | null {
  if (!title.trim()) return null
  const lower = title.toLowerCase()
  for (const cat of DEFAULT_CATEGORIES) {
    if (cat.keywords.some((kw) => lower.includes(kw))) {
      return cat
    }
  }
  return null
}

export function getCategoryColor(categoryName: string | null | undefined): string {
  if (!categoryName) return "#94A3B8"
  return DEFAULT_CATEGORIES.find((c) => c.name === categoryName)?.color ?? "#94A3B8"
}
