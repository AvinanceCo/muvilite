// Explicit preview fixtures. Imported only by VITE_DEMO_MODE=true builds.
const art = (name) => `/demo/${name}.jpg`;
const raw = [
  [
    "dune",
    "تل‌ماسه: بخش دوم",
    "DUNE: PART TWO",
    8.5,
    2024,
    "علمی‌تخیلی، ماجراجویی",
    "جهان، در انتظار یک انتخاب.",
    "پل آتریدس در کنار چانی و مردم فرمن، سفری تازه را آغاز می‌کند؛ سفری میان عشق، سرنوشت و آینده‌ای که باید تغییر کند.",
  ],
  [
    "interstellar",
    "میان‌ستاره‌ای",
    "INTERSTELLAR",
    8.7,
    2014,
    "علمی‌تخیلی، درام",
    "عشق، فراتر از زمان و مکان.",
    "گروهی از کاوشگران برای یافتن خانه‌ای تازه برای بشر، سفری را به آن سوی کهکشان آغاز می‌کنند.",
  ],
  [
    "batman",
    "بتمن",
    "THE BATMAN",
    7.8,
    2022,
    "جنایی، معمایی",
    "هر شهر، سایه‌ای دارد.",
    "در خیابان‌های باران‌خورده گاتهام، معمایی تازه بتمن را به قلب تاریک شهر می‌کشاند.",
  ],
  [
    "oppenheimer",
    "اوپنهایمر",
    "OPPENHEIMER",
    8.3,
    2023,
    "درام، تاریخی",
    "لحظه‌ای که جهان تغییر کرد.",
    "روایت زندگی جی. رابرت اوپنهایمر و تصمیمی که مسیر تاریخ را برای همیشه تغییر داد.",
  ],
  [
    "inception",
    "تلقین",
    "INCEPTION",
    8.8,
    2010,
    "اکشن، علمی‌تخیلی",
    "یک ایده، آغاز همه‌چیز است.",
    "یک متخصص ورود به رؤیاها مأموریتی متفاوت می‌گیرد: کاشتن یک ایده در ذهن، به‌جای دزدیدن آن.",
  ],
  [
    "darkknight",
    "شوالیه تاریکی",
    "THE DARK KNIGHT",
    9.0,
    2008,
    "اکشن، جنایی",
    "وقتی تاریکی، شهر را فرا می‌گیرد.",
    "بتمن با ورود جوکر با چالشی روبه‌رو می‌شود که مرز میان قهرمانی و فداکاری را از نو تعریف می‌کند.",
  ],
  [
    "soul",
    "روح",
    "SOUL",
    8.0,
    2020,
    "انیمیشن، خانوادگی",
    "معنای زندگی را کجا پیدا می‌کنیم؟",
    "یک نوازنده جاز در سفری غیرمنتظره، لذت‌های کوچک زندگی و معنای دنبال کردن یک رؤیا را دوباره کشف می‌کند.",
  ],
  [
    "spiderverse",
    "مرد عنکبوتی: در میان دنیای عنکبوتی",
    "ACROSS THE SPIDER-VERSE",
    8.6,
    2023,
    "انیمیشن، ماجراجویی",
    "داستان خودت را بنویس.",
    "مایلز مورالس به دنیایی از مردان عنکبوتی قدم می‌گذارد؛ جایی که قهرمان بودن، معنای تازه‌ای پیدا می‌کند.",
  ],
];
export const movies = raw.map(
  (
    [
      id,
      titleFa,
      titleEn,
      imdbRank,
      publishYear,
      subtitle,
      tagline,
      descriptionFa,
    ],
    i,
  ) => ({
    _id: id,
    id,
    titleFa,
    titleEn,
    imdbRank,
    publishYear,
    subtitle,
    tagline,
    descriptionFa,
    posterPath: art(id),
    thumbnailPath: art(id),
    backdropPath: art(
      ["dune", "interstellar", "batman"].includes(id) ? `hero-${id}` : id,
    ),
    hero: ["dune", "interstellar", "batman"].includes(id),
    quality: "4K",
    badge: i === 0 ? "پیشنهاد تماشا" : i === 7 ? "انیمیشن" : null,
    country: { fa: "آمریکا" },
    movieLength: [166, 169, 176, 180, 148, 152, 100, 140][i],
    ageRange: { nameFa: i > 5 ? "۷+" : "۱۵+" },
    genres: subtitle.split("، ").map((nameFa, i) => ({ id: i, nameFa })),
    casts: [],
    demo: true,
  }),
);
export const categories = [
  {
    id: "featured",
    nameFa: "منتخب‌های مووی",
    ids: [
      "dune",
      "oppenheimer",
      "interstellar",
      "batman",
      "inception",
      "darkknight",
      "spiderverse",
      "soul",
    ],
  },
  {
    id: "popular",
    nameFa: "داستان‌هایی که با شما می‌مانند",
    ids: ["interstellar", "batman", "dune", "inception", "oppenheimer"],
  },
  {
    id: "animation",
    nameFa: "دنیای رنگی انیمیشن",
    ids: ["spiderverse", "soul"],
  },
];
const select = (ids) => ids.map((id) => movies.find((m) => m.id === id));
function page(slug) {
  if (slug !== "film")
    return {
      page: { titleFa: slug === "music" ? "موسیقی" : "کلیپ‌های کوتاه" },
      blocks: [],
    };
  return {
    page: { titleFa: "فیلم و سریال" },
    blocks: [
      {
        type: "category",
        category: categories[0],
        items: select(categories[0].ids),
      },
      {
        type: "category",
        presentation: "landscape",
        category: categories[1],
        items: select(categories[1].ids),
      },
      {
        type: "banner",
        style: "item",
        items: [
          {
            _id: "journey",
            imagePath: art("hero-interstellar"),
            titleFa: "سفری به آن‌سوی خیال",
            subtitleFa: "جهان‌های تازه را کشف کن",
            labelFa: "علمی‌تخیلی",
            url: "/category/scifi",
          },
          {
            _id: "dark",
            imagePath: art("hero-batman"),
            titleFa: "هیجان، تا آخرین لحظه",
            subtitleFa: "یک معما، هزار احتمال",
            labelFa: "جنایی و معمایی",
            url: "/category/crime",
          },
        ],
      },
      {
        type: "category",
        category: { id: "latest", nameFa: "دوباره دیدنی‌ها" },
        items: select([
          "oppenheimer",
          "inception",
          "darkknight",
          "interstellar",
          "dune",
          "batman",
          "soul",
          "spiderverse",
        ]),
      },
    ],
  };
}
function sorted(items, sort) {
  return [...items].sort((a, b) =>
    sort === "imdb_rank"
      ? b.imdbRank - a.imdbRank
      : sort === "publish_date"
        ? b.publishYear - a.publishYear
        : 0,
  );
}
function paginate(items, p = {}) {
  const page = Math.max(1, Number(p.page) || 1),
    limit = Math.max(1, Number(p.limit) || 24),
    total = items.length;
  return {
    items: items.slice((page - 1) * limit, page * limit),
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasNextPage: page * limit < total,
      hasPrevPage: page > 1,
    },
  };
}
export async function demoResponse({ url, params = {}, data }) {
  if (url === "/branding")
    return {
      data: {
        siteName: "MuviLite",
        theme: "dark-blue",
        homeTitle: "دنیای تماشای شما",
        homeDescription: "هر سلیقه‌ای، یک دنیای تماشایی.",
      },
    };
  if (url === "/placeholders") return { data: {} };
  if (url === "/ads/placements") return { data: { top: [], bottom: [] } };
  if (url === "/ads/preroll") return { data: null };
  if (url.startsWith("/pages/"))
    return { data: page(decodeURIComponent(url.split("/")[2])) };
  if (url.startsWith("/movies/")) {
    const id = url.split("/")[2],
      m = movies.find((m) => m.id === id);
    if (!m)
      throw Object.assign(new Error("این عنوان پیدا نشد."), {
        status: 404,
        isNotFound: true,
      });
    return {
      data: url.endsWith("/similar")
        ? movies.filter((n) => n.id !== id).slice(0, 6)
        : m,
    };
  }
  if (url === "/search") {
    const normalize = (s) =>
      s
        .toLowerCase()
        .replace(/ي/g, "ی")
        .replace(/ك/g, "ک")
        .replace(/[\s‌:،-]/g, "");
    const q = normalize(params.text || "");
    const found = sorted(
      movies.filter((m) => normalize(m.titleFa + m.titleEn).includes(q)),
      params.item_sort,
    );
    const { items, meta } = paginate(found, params);
    return { data: items, meta };
  }
  if (url.startsWith("/categories/")) {
    const id = url.split("/")[2];
    const cat = categories.find((c) => c.id === id);
    const list = cat
      ? select(cat.ids)
      : id === "scifi"
        ? movies.filter((m) => m.subtitle.includes("علمی"))
        : id === "crime"
          ? movies.filter((m) => m.subtitle.includes("جنایی"))
          : movies;
    const { items, meta } = paginate(sorted(list, params.item_sort), params);
    return {
      data: {
        category: cat || {
          id,
          nameFa:
            id === "scifi"
              ? "سفر به جهان‌های دیگر"
              : id === "crime"
                ? "جنایی و معمایی"
                : "دوباره دیدنی‌ها",
        },
        items,
      },
      meta,
    };
  }
  if (url === "/games" || url === "/musics")
    return { data: [], meta: { page: 1, total: 0, totalPages: 0 } };
  if (url === "/watch-sessions")
    return {
      data: {
        sessionId: "preview-session",
        intervalSecond: 30,
        movie: {
          ...movies.find((m) => m.id === data.movieId),
          titleFa: "ویدئوی نمونه طبیعت",
          posterPath: null,
          videoPath: "/demo/sample-flower.mp4",
        },
      },
    };
  if (url.startsWith("/watch-sessions/")) return { data: {} };
  if (url === "/poll/questions") return { data: [] };
  throw Object.assign(new Error("این بخش در نسخه نمایشی داده‌ای ندارد."), {
    status: 404,
    isNotFound: true,
  });
}
