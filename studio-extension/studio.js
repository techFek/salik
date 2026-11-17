
(function(){

  /* =========================================================
     DEFAULT DETECTION LISTS
  ========================================================== */
  const DEFAULT_SINGLE = [
    // fuck family (incl. informal "dropped g" spellings some subtitles use literally)
    "fuck","fucks","fucking","fuckin","fuckin'","fucked","fucker","fuckers","fuckup","fuckups",
    "motherfucker","motherfuckers","fuckface","fuckwit","fuckhead","fuckery","fucktard",
    // euphemistic softened spellings that still count as profanity
    "effing","effin","effin'","freaking","freakin","freakin'","frigging","friggin","friggin'",
    // shit family
    "shit","shits","shitty","shitting","shittin'","shithead","shitheads","bullshit","bullshitting",
    "shithole","shitholes","shitload","shitstorm","shitshow","shitbag","dipshit","batshit",
    "shitless","dogshit","chickenshit","apeshit","shitlist","shitton","holyshit","shitpost","shitstain",
    "horseshit","shitfaced","shite","shitface","shitcan","shitfit",
    // ass family
    "ass","asses","asshole","assholes","jackass","jackasses","dumbass","dumbasses",
    "badass","hardass","asswipe","arse","arsehole","asshat","assclown","assmonkey","assmunch",
    "uglyass","fatass","lameass","weakass","sorryass","bigass","halfass","halfassed",
    // bitch family
    "bitch","bitches","bitchy","bitching","bitchin'",
    // bastard
    "bastard","bastards",
    // damn / hell / religious exclamations
    "damn","damned","damnit","dammit","damning","goddamn","goddammit","goddamnit","hell","helluva",
    "god","godawful","jesus","christ","lord",
    // dick / cock / pussy family
    "dick","dicks","dickhead","dickheads","cock","cocks","cocksucker","cockhead","cockblock",
    "pussy","pussies","pecker",
    // piss family
    "piss","pisses","pissed","pissing","pissy","pissin'",
    // whore / slut family
    "whore","whores","whorish","whorehouse","hooker","hookers","slut","sluts","slutty","skank",
    // crap family
    "crap","craps","crappy",
    // prick / twat / wank family
    "prick","pricks","twat","twats","wank","wanker","wankers","wanking","wankin'",
    // douche family
    "douche","douchebag","douchebags",
    // bloody / bugger / British-English profanity
    "bloody","bugger","buggered","bollocks","tosser","git","minger","plonker",
    // internet-speak abbreviations built from profanity
    "wtf","stfu","gtfo","omfg","af",
    // mild insults and derivatives
    "idiot","idiots","idiotic","stupid","stupidity","moron","morons","moronic",
    "dumb","dumber","dumbest","dummy","dummies","retard","retarded","imbecile",
    "imbeciles","fool","fools","foolish","dope","dopes","nitwit","nitwits",
    "twit","twits","jerk","jerks","loser","losers","freak","freaks","pathetic","lame",
    "scumbag","lowlife","creep","fugly",
    // sexual / nudity-adjacent single words (explicit)
    "sex","sexy","sexual","naked","nude","nudity","boobs","breasts","condoms",
    "orgasm","penis","vagina","vaginal","porn","pornography","butt","butts",
    "cum","jizz","dildo","vibrator","semen","testicle","testicles","scrotum",
    "blowjob","handjob","rimjob","gangbang","threesome","foursome","orgy",
    "masturbate","jackoff","jerkoff","fellatio","cunnilingus","muff",
    // custom terms
    "hot"
  ];

  // Arabic (فصحى) and Egyptian-dialect (عامية مصرية) profanity/insults,
  // grouped the same way as the English list above.
  const DEFAULT_ARABIC = [
    // mild insults — stupidity / contempt
    "غبي","غبية","اغبياء","احمق","حمقاء","حمار","حمير","عبيط","عبيطة","عبطاء","مجنون","مجنونة","هبل","اهبل","هبلة","حولة","متخلف","متخلفة","قبيح","قبيحة",
    "معفن","معفنة","حقير","حقيرة","وغد","نذل","نذلة","ندل","تافه","تافهة","زبالة","سافل","سافلة","جبان","جبانة",
    "وسخ","وسخة","أوسخ","وساخة","الوساخة","قذر","قذرة","خنزير","كلب","كلاب","كلبة","حيوان","واطي","واطية","جزمة",
    // religious/curse exclamations
    "لعنة","يلعن","لعينة","ملعون","ملعونة","تبا",
    // swearing by other than God (حلف بغير الله) — exact fused forms only,
    // so plain "النبي" (respectful reference) is never touched
    "والنبي","ياللهوي","والنعمة","بالذمة","بذمتك","بزمتك",
    // strong profanity / vulgar (Egyptian, commonly censored on TV)
    "خرا","خره","عرص","عرصة","قحبة","قحاب","شرموطة","شراميط","متناك","متناكة",
    "كس","طيز","زق",
    // explicit sexual/insult nouns with possessive-suffix inflections
    // (e.g. عاهرة -> عاهرته/عاهرتك/عاهرتي)
    "عاهرة","عاهرته","عاهرتك","عاهرتي",
    "فاجر","فاجرة","فاجرته","فاجرتك","فاجرتي",
    "شرموطته","شرموطتك","شرموطتي",
    "قحبته","قحبتك","قحبتي",
    // sexual / nudity-adjacent
    "جنس","جنسي","عاري","عارية","سكس","مضاجعة","مؤخرة","مزة","مزز","موزة"
  ];
  // merged into the same detection bucket as the English list — the app
  // doesn't care what language a token is, only whether it's in the set.
  DEFAULT_SINGLE.push(...DEFAULT_ARABIC);

  // Alcohol & drug/substance names — English and Arabic (Fusha + Egyptian),
  // merged into the same single-word detection bucket.
  const DEFAULT_SUBSTANCES = [
    // English
    "alcohol","alcoholic","alcoholics","beer","wine","vodka","whiskey","whisky","rum","tequila","gin",
    "cocaine","heroin","marijuana","weed","cannabis","hashish","meth","crack",
    "opium","ecstasy","lsd","cigarette","cigarettes","cigs","narcotic","narcotics","drugs","dope","joint","stoned","junkie","addict","addicts",
    // Arabic (فصحى / مصري)
    "كحول","خمر","خمور","نبيذ","بيرة","ويسكي","فودكا","حشيش","بانجو",
    "مخدرات","كوكايين","هيروين","حبوب","طرشة","سكران","سكرانة","سكري","مسطول","مسطولة","مبرشم","مبرشمة","تعاطي","مدمن","مدمنة"
  ];
  DEFAULT_SINGLE.push(...DEFAULT_SUBSTANCES);

  const DEFAULT_PHRASE = [
    "sleeping with","sleep with",
    // Arabic/Egyptian curse & insult phrases (multi-word — matched against
    // the whole line, timed across the matched words)
    // fate/time-cursing (سب الدهر)
    "يا نهار اسود","يا يوم اسود","نهارك اسود","نهار ابوك اسود",
    // swearing by other than God (حلف بغير الله)
    "يا لهوي","وحياة امك","وحياة ابوك","وحياة ابني","ورحمة ابويا",
    // curses/ill-wishes against others (الدعاء على الغير)
    "الله يخرب بيتك","يخرب بيتك","يخربيتك","يلعن ابوك","الله يلعنك","الله يلعن","اللعنة عليك","يارب ياخدك","ربنا ياخدك","يحرقك",
    // insults (شتائم)
    "يا ابن الوسخة","ابن الكلب","ابن كلب","روح امك","بتاع النسوان","يا دون","ابن الدون","ابن دون","ولاد الجزمة","قليل الأدب","ابن صرمة"
  ];
  // Cleared by request — no default patterns trigger the "Nudity/blur"
  // sentence-level flagging anymore. Only the single-word and multi-word
  // phrase lists (mute action) are active by default. You can still add
  // your own patterns here later via the "Nudity-content patterns" panel
  // if you ever want that feature back for specific cases.
  const DEFAULT_SUGGESTIVE = [];

  document.getElementById('listSingle').value = DEFAULT_SINGLE.join('\n');
  document.getElementById('listPhrase').value = DEFAULT_PHRASE.join('\n');
  document.getElementById('listSuggestive').value = DEFAULT_SUGGESTIVE.join('\n');

  /* =========================================================
     STATE
  ========================================================== */
  let subs = [];          // parsed subtitle entries {start,end,text}
  let rows = [];          // detection rows {uid,start,end,category,description,action,sentence}
  let totalDuration = 0;
  let uidCounter = 1;
  let currentFilter = 'all';
  let sortDir = 'asc';
  let hasUnsavedChanges = false;
  let syncAnchors = [];
  let currentSearch = '';
  let rawSrtText = '';
  let cleanerResultData = null; // {srtText, blocks, stats}

  const els = {
    fileInput: document.getElementById('fileInput'),
    dropZone: document.getElementById('dropZone'),
    fileName: document.getElementById('fileName'),
    processBtn: document.getElementById('processBtn'),
    cleanerDropZone: document.getElementById('cleanerDropZone'),
    cleanerFileInput: document.getElementById('cleanerFileInput'),
    cleanerFileName: document.getElementById('cleanerFileName'),
    cleanerResult: document.getElementById('cleanerResult'),
    cleanerActions: document.getElementById('cleanerActions'),
    cleanerDownloadBtn: document.getElementById('cleanerDownloadBtn'),
    cleanerUseBtn: document.getElementById('cleanerUseBtn'),
    clearSessionBtn: document.getElementById('clearSessionBtn'),
    anchorList: document.getElementById('anchorList'),
    anchorOrig: document.getElementById('anchorOrig'),
    anchorActual: document.getElementById('anchorActual'),
    addAnchorBtn: document.getElementById('addAnchorBtn'),
    applySyncBtn: document.getElementById('applySyncBtn'),
    saveProjectBtn: document.getElementById('saveProjectBtn'),
    loadProjectBtn: document.getElementById('loadProjectBtn'),
    loadProjectInput: document.getElementById('loadProjectInput'),
    filmTitle: document.getElementById('filmTitle'),
    statDuration: document.getElementById('statDuration'),
    statMute: document.getElementById('statMute'),
    statReview: document.getElementById('statReview'),
    statPblur: document.getElementById('statPblur'),
    statSkip: document.getElementById('statSkip'),
    ruler: document.getElementById('ruler'),
    track: document.getElementById('track'),
    tableArea: document.getElementById('tableArea'),
    rowCount: document.getElementById('rowCount'),
    searchBox: document.getElementById('searchBox'),
    addRowBtn: document.getElementById('addRowBtn'),
    exportCsvBtn: document.getElementById('exportCsvBtn'),
    exportJsonBtn: document.getElementById('exportJsonBtn'),
    toast: document.getElementById('toast'),
  };

  function toast(msg){
    els.toast.textContent = msg;
    els.toast.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(()=>els.toast.classList.remove('show'), 2600);
  }

  function fmtTime(totalSeconds){
    totalSeconds = Math.max(0, Math.floor(totalSeconds));
    const h = Math.floor(totalSeconds/3600);
    const m = Math.floor((totalSeconds%3600)/60);
    const s = totalSeconds%60;
    return [h,m,s].map(n=>String(n).padStart(2,'0')).join(':');
  }

  /* =========================================================
     SRT PARSING
  ========================================================== */
  function timeToSeconds(h,m,s,ms){ return h*3600 + m*60 + s + ms/1000; }

  function parseSRT(text){
    text = text.replace(/\r\n/g,'\n').replace(/\r/g,'\n');
    const blocks = text.split(/\n\s*\n/).filter(b=>b.trim().length>0);
    const out = [];
    const timeRe = /(\d{2}):(\d{2}):(\d{2})[,.](\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2})[,.](\d{3})/;
    for(const block of blocks){
      const lines = block.split('\n').map(l=>l.trim()).filter(l=>l.length>0);
      const idx = lines.findIndex(l=>timeRe.test(l));
      if(idx===-1) continue;
      const m = lines[idx].match(timeRe);
      const start = timeToSeconds(+m[1],+m[2],+m[3],+m[4]);
      const end = timeToSeconds(+m[5],+m[6],+m[7],+m[8]);
      const textLines = lines.slice(idx+1);
      const fullText = textLines.join(' ').replace(/<[^>]+>/g,'').trim();
      if(fullText) out.push({start, end, text: fullText});
    }
    return out;
  }

  /* =========================================================
     SRT CLEANER — strips audio descriptions, bracketed notes, and
     speaker-name prefixes from an .srt. Runs entirely client-side.
  ========================================================== */
  // Parses into blocks that keep each cue's lines separate (not joined),
  // since the speaker-name rule is anchored to the start of each line —
  // parseSRT() above collapses lines into one string, which would hide
  // a second speaker starting mid-string after the first line.
  function parseSrtBlocksForCleaning(text){
    text = text.replace(/\r\n/g,'\n').replace(/\r/g,'\n');
    const blocks = text.split(/\n\s*\n/).filter(b=>b.trim().length>0);
    const timeRe = /(\d{2}):(\d{2}):(\d{2})[,.](\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2})[,.](\d{3})/;
    const out = [];
    for(const block of blocks){
      const lines = block.split('\n').map(l=>l.trim()).filter(l=>l.length>0);
      const idx = lines.findIndex(l=>timeRe.test(l));
      if(idx===-1) continue;
      const m = lines[idx].match(timeRe);
      const start = timeToSeconds(+m[1],+m[2],+m[3],+m[4]);
      const end = timeToSeconds(+m[5],+m[6],+m[7],+m[8]);
      const textLines = lines.slice(idx+1).map(l=>l.replace(/<[^>]+>/g,''));
      out.push({ timecodeRaw: lines[idx], start, end, lines: textLines });
    }
    return out;
  }

  const SPEAKER_PREFIX_RE = /^-?\s*[\p{L}][\p{L}\p{N} .'#\-]{0,29}:\s+/u;
  const SPEAKER_STANDALONE_RE = /^-?\s*[\p{L}][\p{L}\p{N} .'#\-]{0,29}:\s*$/u;

  function cleanSrtText(rawText){
    const blocks = parseSrtBlocksForCleaning(rawText);
    let removedEmptyBlocks = 0;
    let strippedAudioDesc = 0;
    let strippedSpeakerNames = 0;

    const cleanedBlocks = [];
    for(const block of blocks){
      const cleanedLines = [];
      for(let line of block.lines){
        const before = line;
        line = line.replace(/\([^)]*\)/g, '');
        line = line.replace(/\[[^\]]*\]/g, '');
        if(line !== before) strippedAudioDesc++;
        line = line.trim();
        // strip a leading dialogue-turn dash ("-Hello" -> "Hello"), and any
        // standalone "-" token elsewhere, so it never counts as a "word" in
        // the weighted-timing prediction later. Hyphens inside real words
        // (well-known) are untouched since they aren't surrounded by spaces.
        line = line.replace(/^-+\s*/, '');
        line = line.replace(/(^|\s)-+(?=\s|$)/g, '$1').replace(/\s+/g, ' ').trim();
        if(SPEAKER_STANDALONE_RE.test(line)){
          strippedSpeakerNames++;
          continue; // whole line is just a speaker label — drop it entirely
        }
        if(SPEAKER_PREFIX_RE.test(line)){
          line = line.replace(SPEAKER_PREFIX_RE, '');
          strippedSpeakerNames++;
        }
        line = line.trim();
        if(line) cleanedLines.push(line);
      }
      if(cleanedLines.length === 0){
        removedEmptyBlocks++;
        continue;
      }
      cleanedBlocks.push({ start: block.start, end: block.end, lines: cleanedLines });
    }

    // renumber sequentially and serialize back to .srt text
    const srtOut = cleanedBlocks.map((b, i) => {
      return (i+1) + '\n' + fmtSrtTime(b.start) + ' --> ' + fmtSrtTime(b.end) + '\n' + b.lines.join('\n');
    }).join('\n\n') + '\n';

    return {
      srtText: srtOut,
      blocks: cleanedBlocks,
      stats: {
        totalBlocksBefore: blocks.length,
        totalBlocksAfter: cleanedBlocks.length,
        removedEmptyBlocks,
        strippedAudioDesc,
        strippedSpeakerNames
      }
    };
  }

  function fmtSrtTime(t){
    const h = Math.floor(t/3600);
    const m = Math.floor((t%3600)/60);
    const s = Math.floor(t%60);
    const ms = Math.round((t - Math.floor(t))*1000);
    const pad = (n,len)=>String(n).padStart(len,'0');
    return pad(h,2)+':'+pad(m,2)+':'+pad(s,2)+','+pad(ms,3);
  }

  /* =========================================================
     WEIGHTED WORD TIMING  (same idea as the python script:
     duration split by character-length of each word, not
     an equal split) — plus optional gaps after certain words:
     a longer pause after a comma (natural speech break), and a
     short gap where a hyphenated compound was split into parts
     (buck-ass -> "buck" then a brief gap then "ass").
  ========================================================== */
  const COMMA_PAUSE_SECONDS = 0.5;
  const HYPHEN_GAP_SECONDS = 0.1;

  function weightedTimings(words, start, duration, pauseAfter){
    // pauseAfter[i] is a duration in seconds (0 or falsy = no gap)
    const totalRequestedPause = pauseAfter ? pauseAfter.reduce((a,b)=>a+(b||0),0) : 0;
    // cap total pause time so a comma/hyphen-heavy line can't eat the whole duration
    const maxPauseTime = duration * 0.8;
    const scale = (totalRequestedPause > maxPauseTime && totalRequestedPause > 0) ? maxPauseTime/totalRequestedPause : 1;
    const speakDuration = duration - totalRequestedPause*scale;

    const weights = words.map(w=>Math.max(w.length,1));
    const total = weights.reduce((a,b)=>a+b,0) || 1;
    let cursor = start;
    const out = [];
    for(let i=0;i<words.length;i++){
      const dur = (weights[i]/total)*speakDuration;
      out.push({word: words[i], start: cursor, end: cursor+dur});
      cursor += dur;
      if(pauseAfter && pauseAfter[i]) cursor += pauseAfter[i]*scale;
    }
    return out;
  }

  function findPhraseSpan(words, timings, phraseWords){
    for(let i=0;i<=words.length-phraseWords.length;i++){
      let ok = true;
      for(let j=0;j<phraseWords.length;j++){
        if(words[i+j] !== phraseWords[j]){ ok=false; break; }
      }
      if(ok){
        return { start: timings[i].start, end: timings[i+phraseWords.length-1].end };
      }
    }
    return null;
  }

  function parseListTextarea(id){
    return document.getElementById(id).value
      .split('\n')
      .map(l=>l.trim())
      .filter(l=>l.length>0);
  }

  // Normalizes a token for matching: lowercases Latin script, strips Arabic
  // diacritics (tashkeel) and tatweel, folds common Arabic letter variants
  // (أ إ آ ٱ -> ا, ى -> ي, ة -> ه) so subtitle spelling differences don't
  // cause missed matches, and trims stray edge apostrophes (fuckin' -> fuckin).
  function normalizeToken(w){
    return w
      .toLowerCase()
      .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, '') // Arabic diacritics/tashkeel
      .replace(/\u0640+/g, '')                             // tatweel (ـ)
      .replace(/[إأآٱ]/g, 'ا')
      .replace(/ى/g, 'ي')
      .replace(/ة/g, 'ه')
      // Persian/Urdu letter variants that render identically to Arabic
      // letters but are different codepoints — common in subtitle files
      // produced by tools/fonts with a Farsi/Urdu-leaning text pipeline.
      .replace(/[\u06A9\u0643]/g, 'ك') // keheh/kaf -> kaf
      .replace(/[\u06CC\u06D2]/g, 'ي') // farsi yeh / yeh barree -> yeh
      .replace(/[\u06C0\u06BE]/g, 'ه') // heh goal / heh doachashmee -> heh
      .replace(/^'+|'+$/g, '');                            // edge apostrophes
  }

  // Arabic attaches short prefixes directly to the next word with no space
  // (الكلب = ال+كلب, ومعفن = و+معفن). Try the token as-is first, then with
  // a common proclitic stripped, so "والغبي" still catches "غبي".
  const ARABIC_PROCLITICS = ["بال","كال","فال","وال","ال","و","ف","ب","ل","ك"];
  function matchesWordDict(word, dict){
    if(dict.has(word)) return true;
    for(const p of ARABIC_PROCLITICS){
      if(word.startsWith(p) && word.length - p.length >= 2 && dict.has(word.slice(p.length))){
        return true;
      }
    }
    return false;
  }

  /* =========================================================
     PROCESS
  ========================================================== */
  function processSubs(){
    const singleWords = new Set(parseListTextarea('listSingle').map(w=>normalizeToken(w)));
    const phrases = parseListTextarea('listPhrase').map(p=>normalizeToken(p));
    const suggestivePatterns = parseListTextarea('listSuggestive');
    let suggestiveRegexes = [];
    try{
      suggestiveRegexes = suggestivePatterns.map(p=>new RegExp(p,'iu'));
    }catch(e){
      toast('One of the suggestive-pattern regexes is invalid — check the list.');
      return;
    }

    // keep whatever the person has already placed for other categories
    // (manually, or from an earlier process run) — only Language gets rebuilt
    const preservedRows = rows.filter(r => r.category !== 'language');
    const overlapsPreserved = (start, end) => preservedRows.some(p => start < p.end && end > p.start);

    const freshRows = [];
    totalDuration = subs.reduce((max,s)=>Math.max(max, s.end), 0);

    for(const sub of subs){
      const original = sub.text.replace(/\n/g,' ');
      // \p{L}/\p{N} (Unicode letters/numbers) instead of \w so Arabic script
      // survives cleanup — plain \w only matches [A-Za-z0-9_]. Tokenize on
      // the original text first (before stripping punctuation) so a comma
      // on a word can be detected as a natural speech pause; periods don't
      // get this treatment. Hyphenated compounds ("buck-ass") are split
      // into separate words ("buck", "ass") with a brief gap between them,
      // rather than merged into one fused token — this lets an existing
      // dictionary word ("ass") still match inside any hyphenated compound
      // without needing every possible compound spelled out. A token that's
      // pure punctuation (e.g. a lone "-") cleans down to nothing per part
      // and is dropped rather than counted.
      const rawTokens = original.split(/\s+/).filter(Boolean);
      const words = [];
      const pauseAfter = [];
      for(const tok of rawTokens){
        const hasComma = /[،,]/.test(tok);
        const parts = tok.split(/-+/).filter(Boolean);
        for(let pi=0; pi<parts.length; pi++){
          const clean = parts[pi].toLowerCase().replace(/[^\p{L}\p{N}']/gu,'');
          if(!clean) continue;
          words.push(clean);
          const isLastPart = pi === parts.length-1;
          let pause = (!isLastPart) ? HYPHEN_GAP_SECONDS : 0;
          if(isLastPart && hasComma) pause = Math.max(pause, COMMA_PAUSE_SECONDS);
          pauseAfter.push(pause);
        }
      }
      if(words.length===0) continue;

      const duration = sub.end - sub.start;
      const timings = weightedTimings(words, sub.start, duration, pauseAfter);
      // mute windows stay inside their subtitle line
      const padStart = t => Math.max(sub.start, t);
      const padEnd = t => Math.min(sub.end, t);

      // 1) single-word profanity
      for(const t of timings){
        if(matchesWordDict(normalizeToken(t.word), singleWords)){
          freshRows.push(makeRow(padStart(t.start), padEnd(t.end), 'language', t.word, 'mute', original));
        }
      }

      // 2) multi-word profanity phrases
      for(const phrase of phrases){
        const phraseWords = phrase.split(/\s+/).filter(Boolean);
        if(phraseWords.length < 2) continue; // single words already covered above
        const span = findPhraseSpan(words.map(normalizeToken), timings, phraseWords);
        if(span){
          freshRows.push(makeRow(padStart(span.start), padEnd(span.end), 'language', phrase, 'mute', original));
        }
      }

      // 3) suggestive / sensitive full-line patterns -> flagged for manual review
      // skipped where a preserved row (manual or earlier run) already covers this moment
      if(!overlapsPreserved(sub.start, sub.end)){
        for(const re of suggestiveRegexes){
          const m = original.match(re);
          if(m){
            freshRows.push(makeRow(sub.start, sub.end, 'nudity', m[0], 'blur', original));
            break; // one flag per line is enough, avoid duplicate review rows
          }
        }
      }
    }

    rows = preservedRows.concat(freshRows);
    rows.sort((a,b)=>a.start-b.start);
    render();
    hasUnsavedChanges = true;
    persist();
    if(rows.length===0){
      toast('Processed — nothing matched the current word lists.');
    }else{
      toast(`Processed — ${rows.filter(r=>r.action==='mute').length} muted, ${rows.filter(r=>r.action==='blur').length} flagged for blur.`);
    }
  }

  function makeRow(start, end, category, description, action, sentence){
    return {
      uid: uidCounter++,
      start: Math.round(start*100)/100,
      end: Math.round(end*100)/100,
      category, description, action, sentence
    };
  }

  /* =========================================================
     RENDER: stats + timeline
  ========================================================== */
  // Runtime/timeline shouldn't depend on a loaded SRT — if the person adds
  // rows manually with no subtitle file, this still reflects those rows.
  function effectiveDuration(){
    const rowsMax = rows.reduce((max,r)=>Math.max(max, r.end), 0);
    return Math.max(totalDuration, rowsMax);
  }

  function renderStats(){
    els.statDuration.textContent = fmtTime(effectiveDuration());
    els.statMute.textContent = rows.filter(r=>r.action==='mute').length;
    els.statReview.textContent = rows.filter(r=>r.action==='blur').length;
    els.statPblur.textContent = rows.filter(r=>r.action==='partial_blur').length;
    els.statSkip.textContent = rows.filter(r=>r.action==='skip').length;
  }

  function renderTimeline(){
    els.ruler.innerHTML = '';
    els.track.innerHTML = '';

    const duration = effectiveDuration();
    if(duration<=0 || (rows.length===0 && subs.length===0)){
      els.track.innerHTML = '<div class="track-empty">Load a subtitle file to see flagged moments plotted here</div>';
      return;
    }

    // ruler ticks: aim for ~6 ticks
    const tickCount = 6;
    for(let i=0;i<=tickCount;i++){
      const t = (duration/tickCount)*i;
      const pct = (t/duration)*100;
      const tick = document.createElement('div');
      tick.className = 'tick';
      tick.style.left = pct+'%';
      tick.textContent = fmtTime(t);
      els.ruler.appendChild(tick);

      const grid = document.createElement('div');
      grid.className = 'gridline';
      grid.style.left = pct+'%';
      els.track.appendChild(grid);
    }

    rows.forEach(r=>{
      const left = (r.start/duration)*100;
      const width = Math.max(((r.end-r.start)/duration)*100, 0.3);
      const block = document.createElement('div');
      const cls = r.action==='mute' ? 'mute' : (r.action==='blur' ? 'review' : (r.action==='partial_blur' ? 'pblur' : 'skip'));
      block.className = 'block ' + cls;
      block.style.left = left+'%';
      block.style.width = width+'%';
      block.title = `${fmtTime(r.start)} — "${r.description}"`;
      block.addEventListener('click', ()=>focusRow(r.uid));
      els.track.appendChild(block);
    });
  }

  function focusRow(uid){
    const el = document.querySelector(`tr[data-uid="${uid}"]`);
    if(!el) return;
    el.scrollIntoView({behavior:'smooth', block:'center'});
    el.classList.remove('flash');
    void el.offsetWidth;
    el.classList.add('flash');
  }

  /* =========================================================
     RENDER: table
  ========================================================== */
  function visibleRows(){
    return rows.filter(r=>{
      if(currentFilter==='mute' && r.action!=='mute') return false;
      if(currentFilter==='blur' && r.action!=='blur') return false;
      if(currentFilter==='skip' && r.action!=='skip') return false;
      if(currentSearch){
        const hay = (r.description+' '+r.sentence).toLowerCase();
        if(!hay.includes(currentSearch.toLowerCase())) return false;
      }
      return true;
    });
  }

  function renderTable(){
    if(rows.length===0){
      els.tableArea.innerHTML = `<div class="empty-state">
        <p class="big">Nothing processed yet</p>
        <p>Load an .srt file on the left and hit Process subtitles. Every muted word and flagged line will show up here, editable before export.</p>
      </div>`;
      els.rowCount.textContent = '';
      els.exportCsvBtn.disabled = true;
      els.exportJsonBtn.disabled = true;
      return;
    }

    els.exportCsvBtn.disabled = false;
    els.exportJsonBtn.disabled = false;

    const vRows = visibleRows();
    if(sortDir==='desc') vRows.reverse();
    let html = `<table><thead><tr>
      <th>#</th><th class="sortable" id="sortStartTh" style="cursor:pointer;">Start ${sortDir==='asc' ? '↑' : '↓'}</th><th>End</th><th>Category</th><th>Word / phrase</th><th>Action</th><th>Sentence</th><th></th>
    </tr></thead><tbody>`;

    vRows.forEach((r, i)=>{
      html += `<tr data-uid="${r.uid}">
        <td class="id"${r.timed==='audio' ? ' title="Timed on the audio"' : ''}>${i+1}${r.timed==='audio' ? ' ✓' : ''}</td>
        <td>
          <input type="number" step="0.01" value="${r.start}" data-field="start" data-uid="${r.uid}">
          <input type="text" class="tc-input" value="${fmtSrtTime(r.start)}" data-field="start-tc" data-uid="${r.uid}" placeholder="00:00:00,000">
        </td>
        <td>
          <input type="number" step="0.01" value="${r.end}" data-field="end" data-uid="${r.uid}">
          <input type="text" class="tc-input" value="${fmtSrtTime(r.end)}" data-field="end-tc" data-uid="${r.uid}" placeholder="00:00:00,000">
        </td>
        <td>
          <select class="cat" data-field="category" data-uid="${r.uid}">
            <option value="language" ${r.category==='language'?'selected':''}>language</option>
            <option value="nudity" ${r.category==='nudity'?'selected':''}>nudity</option>
            <option value="violence" ${r.category==='violence'?'selected':''}>violence</option>
            <option value="substance abuse" ${r.category==='substance abuse'?'selected':''}>substance abuse</option>
          </select>
        </td>
        <td><input type="text" value="${escapeAttr(r.description)}" data-field="description" data-uid="${r.uid}"></td>
        <td>
          <select class="action" data-field="action" data-uid="${r.uid}">
            <option value="mute" ${r.action==='mute'?'selected':''}>mute</option>
            <option value="blur" ${r.action==='blur'?'selected':''}>blur</option>
            <option value="skip" ${r.action==='skip'?'selected':''}>skip</option>
            <option value="partial_blur" ${r.action==='partial_blur'?'selected':''}>partial blur</option>
          </select>
        </td>
        <td class="sentence"><input type="text" value="${escapeAttr(r.sentence)}" data-field="sentence" data-uid="${r.uid}" ${r.action==='partial_blur' ? `placeholder="الصق هنا الكود الناتج من Nazafa Blur Picker"` : ''}></td>
        <td style="white-space:nowrap;">
          <button class="del-btn st-play-row" data-uid="${r.uid}" title="Play this moment in the video" aria-label="Play">▶</button>
          <button class="del-btn anchor-fill-btn" data-uid="${r.uid}" title="Use this line's exact SRT timestamp as a sync point" aria-label="Use as sync reference">⏱</button>
          <button class="del-btn delete-row-btn" data-uid="${r.uid}" title="Delete row" aria-label="Delete row">×</button>
        </td>
      </tr>`;
    });

    html += '</tbody></table>';
    els.tableArea.innerHTML = html;
    els.rowCount.textContent = `${vRows.length} of ${rows.length} rows shown`;

    // bind edit handlers
    els.tableArea.querySelectorAll('input[data-field], select[data-field]').forEach(input=>{
      input.addEventListener('change', onCellEdit);
    });
    const sortTh = document.getElementById('sortStartTh');
    if(sortTh){
      sortTh.addEventListener('click', ()=>{
        sortDir = sortDir==='asc' ? 'desc' : 'asc';
        renderTable();
      });
    }
    els.tableArea.querySelectorAll('.delete-row-btn').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        rows = rows.filter(r=>r.uid !== Number(btn.dataset.uid));
        render();
        hasUnsavedChanges = true;
        persist();
      });
    });
    els.tableArea.querySelectorAll('.st-play-row').forEach(btn=>{
      btn.addEventListener('click', ()=> stPlayRow(Number(btn.dataset.uid)));
    });
    if(stCurrentUid !== null){
      const tr = els.tableArea.querySelector(`tr[data-uid="${stCurrentUid}"]`);
      if(tr) tr.classList.add('st-current');
    }
    els.tableArea.querySelectorAll('.anchor-fill-btn').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        const row = rows.find(r=>r.uid === Number(btn.dataset.uid));
        if(!row) return;
        const srtTime = findSubStartForRow(row);
        document.getElementById('anchorOrig').value = srtTime;
        document.getElementById('anchorActual').focus();
        if(srtTime === row.start){
          toast('SRT time filled in — type the real time you saw on the platform, then Add reference point.');
        }else{
          toast('Snapped to this line\'s exact SRT timestamp (' + srtTime + 's) — more reliable than the estimated word time. Type the real time you saw, then Add reference point.');
        }
      });
    });
  }

  function escapeAttr(s){
    return String(s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;');
  }

  function parseTimecodeToSeconds(str){
    const m = String(str).trim().match(/^(\d{1,2}):(\d{2}):(\d{2})[.,](\d{1,3})$/);
    if(!m) return null;
    const h = +m[1], mi = +m[2], s = +m[3];
    const ms = +m[4].padEnd(3,'0');
    return h*3600 + mi*60 + s + ms/1000;
  }

  function onCellEdit(e){
    const uid = Number(e.target.dataset.uid);
    const field = e.target.dataset.field;
    const row = rows.find(r=>r.uid===uid);
    if(!row) return;

    if(field==='start-tc' || field==='end-tc'){
      const seconds = parseTimecodeToSeconds(e.target.value);
      if(seconds===null){
        toast('Invalid timecode — use HH:MM:SS,mmm (e.g. 00:06:43,000).');
        e.target.value = fmtSrtTime(field==='start-tc' ? row.start : row.end);
        return;
      }
      const targetField = field==='start-tc' ? 'start' : 'end';
      row[targetField] = Math.round(seconds*100)/100;
      rows.sort((a,b)=>a.start-b.start);
      render();
      hasUnsavedChanges = true;
      persist();
      return;
    }

    let val = e.target.value;
    if(field==='start' || field==='end') val = parseFloat(val) || 0;
    row[field] = val;
    if(field==='start' || field==='end'){
      rows.sort((a,b)=>a.start-b.start);
      render();
    }else{
      renderTimeline(); // category/action colour may have changed
      renderStats();
    }
    if(field==='action' && val==='partial_blur'){
      copyPartialBlurSnippet(row);
    }
    if(field==='sentence' && row.action==='partial_blur' && val.trim()){
      applyPastedBlurRegion(row, val);
    }
    hasUnsavedChanges = true;
    persist();
  }

  // لما المستخدم يلزق في خانة الـ Sentence الكود اللي نسخه من أداة Nazafa Blur Picker
  // (زي: "action_type": "partial_blur", "blur_region": {"x":0.62,"y":0.55,"width":0.08,"height":0.12})
  // بنستخرج منه الإحداثيات الحقيقية ونحطها بدل المربع الافتراضي المؤقت.
  function applyPastedBlurRegion(row, pastedText){
    const match = pastedText.match(/"blur_region"\s*:\s*(\{[^}]*\})/);
    if(!match){
      toast('⚠️ مالقتش blur_region جوه النص اللي لزقته — تأكد إنك لزقت الكود كامل من Nazafa Blur Picker.');
      return;
    }
    try{
      const region = JSON.parse(match[1]);
      if(typeof region.x!=='number' || typeof region.y!=='number' || typeof region.width!=='number' || typeof region.height!=='number'){
        throw new Error('incomplete region');
      }
      row.blur_region = region;
      toast('✅ اتسجلت إحداثيات التغبيش الجزئي الحقيقية لهذا الصف.');
    }catch(err){
      toast('⚠️ الكود اللي لزقته فيه مشكلة — اتأكد إنه منسوخ كامل من Nazafa Blur Picker من غير تعديل.');
    }
  }

  // لما تختار "partial blur" من قائمة Action، بننسخ نص جاهز تلزقه على طول:
  // action_type + blur_region (منطقة افتراضية مؤقتة). المنطقة الحقيقية لازم تُحدَّد
  // من على الفيديو الأصلي (المنصة اللي شغال عليها الفيلم) باستخدام أداة
  // partial-blur-picker-bookmarklet.html، لأن Nazafa Studio نفسه معندوش معاينة فيديو.
  function copyPartialBlurSnippet(row){
    if(!row.blur_region){
      row.blur_region = { x: 0.5, y: 0.5, width: 0.1, height: 0.1 };
    }
    const snippet = `"action_type": "partial_blur", "blur_region": ${JSON.stringify(row.blur_region)}`;
    try{
      navigator.clipboard.writeText(snippet);
      toast('✅ اتنسخ الكود — دا مربع افتراضي مؤقت، حدد المكان الحقيقي بأداة Nazafa Blur Picker على الفيديو الأصلي وابدله.');
    }catch(err){
      toast('مقدرت انسخ للكليبورد تلقائي — الكود: ' + snippet);
    }
  }

  function render(){
    renderStats();
    renderTimeline();
    renderTable();
  }

  /* =========================================================
     FILE HANDLING
  ========================================================== */
  els.dropZone.addEventListener('click', ()=>els.fileInput.click());
  els.dropZone.addEventListener('dragover', e=>{ e.preventDefault(); els.dropZone.classList.add('drag'); });
  els.dropZone.addEventListener('dragleave', ()=>els.dropZone.classList.remove('drag'));
  els.dropZone.addEventListener('drop', e=>{
    e.preventDefault();
    els.dropZone.classList.remove('drag');
    if(e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]);
  });
  els.fileInput.addEventListener('change', e=>{
    if(e.target.files.length) handleFile(e.target.files[0]);
  });

  function handleFile(file){
    if(!file.name.toLowerCase().endsWith('.srt')){
      toast('That does not look like an .srt file.');
      return;
    }
    const reader = new FileReader();
    reader.onload = evt=>{
      rawSrtText = evt.target.result;
      subs = parseSRT(rawSrtText);
      els.fileName.textContent = `${file.name} — ${subs.length} lines`;
      els.processBtn.disabled = subs.length===0;
      if(subs.length===0) toast('Could not find any timed lines in that file.');
      const guess = file.name.replace(/\.srt$/i,'').replace(/[-_]/g,' ').trim();
      if(guess) els.filmTitle.value = guess;
    };
    reader.onerror = ()=> toast('Could not read that file.');
    reader.readAsText(file);
  }

  /* -------------------- SRT Cleaner -------------------- */
  els.cleanerDropZone.addEventListener('click', ()=>els.cleanerFileInput.click());
  els.cleanerDropZone.addEventListener('dragover', e=>{ e.preventDefault(); els.cleanerDropZone.classList.add('drag'); });
  els.cleanerDropZone.addEventListener('dragleave', ()=>els.cleanerDropZone.classList.remove('drag'));
  els.cleanerDropZone.addEventListener('drop', e=>{
    e.preventDefault();
    els.cleanerDropZone.classList.remove('drag');
    if(e.dataTransfer.files.length) handleCleanerFile(e.dataTransfer.files[0]);
  });
  els.cleanerFileInput.addEventListener('change', e=>{
    if(e.target.files.length) handleCleanerFile(e.target.files[0]);
  });

  function handleCleanerFile(file){
    if(!file.name.toLowerCase().endsWith('.srt')){
      toast('That does not look like an .srt file.');
      return;
    }
    const reader = new FileReader();
    reader.onload = evt=>{
      const result = cleanSrtText(evt.target.result);
      cleanerResultData = result;
      cleanerResultData.sourceFileName = file.name;
      els.cleanerFileName.textContent = `${file.name} — ${result.stats.totalBlocksAfter} cues remain`;

      const s = result.stats;
      els.cleanerResult.style.display = 'block';
      els.cleanerResult.innerHTML =
        `Blocks before: ${s.totalBlocksBefore}<br>` +
        `Blocks after: ${s.totalBlocksAfter}<br>` +
        `Empty blocks removed: ${s.removedEmptyBlocks}<br>` +
        `Lines with audio descriptions cleaned: ${s.strippedAudioDesc}<br>` +
        `Speaker-name prefixes removed: ${s.strippedSpeakerNames}`;
      els.cleanerActions.style.display = 'flex';
      els.cleanerActions.style.flexDirection = 'column';
      toast('SRT cleaned — review the summary on the left.');
    };
    reader.onerror = ()=> toast('Could not read that file.');
    reader.readAsText(file);
  }

  els.cleanerDownloadBtn.addEventListener('click', ()=>{
    if(!cleanerResultData) return;
    const base = (cleanerResultData.sourceFileName || 'subtitle').replace(/\.srt$/i, '');
    downloadBlob(cleanerResultData.srtText, `${base}_cleaned.srt`, 'text/plain');
    toast('Cleaned .srt downloaded.');
  });

  els.cleanerUseBtn.addEventListener('click', ()=>{
    if(!cleanerResultData) return;
    subs = cleanerResultData.blocks.map(b => ({
      start: b.start,
      end: b.end,
      text: b.lines.join(' ')
    }));
    rawSrtText = cleanerResultData.srtText;
    els.fileName.textContent = `${cleanerResultData.sourceFileName} (cleaned) — ${subs.length} lines`;
    els.processBtn.disabled = subs.length===0;
    const guess = (cleanerResultData.sourceFileName || '').replace(/\.srt$/i,'').replace(/[-_]/g,' ').trim();
    if(guess) els.filmTitle.value = guess;
    processSubs();
    toast('Cleaned subtitles loaded — processed for language detection.');
  });

  els.processBtn.addEventListener('click', processSubs);

  /* =========================================================
     FILTER / SEARCH
  ========================================================== */
  document.querySelectorAll('.filter-row button').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      document.querySelectorAll('.filter-row button').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
      currentFilter = btn.dataset.filter;
      renderTable();
      hasUnsavedChanges = true;
      persist();
    });
  });
  els.searchBox.addEventListener('input', e=>{
    currentSearch = e.target.value;
    renderTable();
  });

  /* =========================================================
     MANUAL ADD ROW
  ========================================================== */
  /* A new row is 10 s long: "Add row" starts it where the last row ends, "Add video time" at the player's time. */
  const NEW_ROW_LEN = 10;
  function addRowAt(start){
    start = Math.max(0, Math.round(start * 1000) / 1000);
    const newRow = makeRow(start, start + NEW_ROW_LEN, 'language', '', 'mute', '');
    rows.push(newRow);
    rows.sort((a,b)=>a.start-b.start);
    render();
    hasUnsavedChanges = true;
    persist();
    focusRow(newRow.uid);
    toast(`Row added at ${fmtTime(start)} — edit it directly in the table.`);
  }
  els.addRowBtn.addEventListener('click', ()=>{
    addRowAt(rows.length ? rows.reduce((max,r)=>Math.max(max, r.end), 0) : (subs.length ? subs[0].start : 0));
  });
  document.getElementById('addVideoRowBtn').addEventListener('click', ()=>{
    const v = stEls.video;
    if(!v.src){ toast('Open the video first (or connect the platform tab).'); return; }
    addRowAt(v.currentTime || 0);
  });

  /* =========================================================
     EXPORT
  ========================================================== */
  function downloadBlob(content, filename, mime){
    const blob = new Blob([content], {type:mime});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function safeName(){
    // \p{L}/\p{N} (Unicode letters/numbers) instead of \w so Arabic titles
    // survive into the exported filename — plain \w only matches [A-Za-z0-9_].
    return (els.filmTitle.value.trim() || 'untitled').replace(/[^\p{L}\p{N}\- ]/gu,'').replace(/\s+/g,'_');
  }

  els.exportCsvBtn.addEventListener('click', ()=>{
    if(typeof XLSX === 'undefined'){
      toast('Excel library failed to load — check your internet connection and try again.');
      return;
    }
    const header = ['id','start','end','category','original_description','action_type','Full_sentence'];
    const data = [header];
    rows.forEach((r,i)=>{
      data.push([i+1, r.start, r.end, r.category, r.description, r.action, r.sentence]);
    });
    const ws = XLSX.utils.aoa_to_sheet(data);
    ws['!cols'] = [{wch:5},{wch:9},{wch:9},{wch:14},{wch:22},{wch:11},{wch:60}];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Review');
    XLSX.writeFile(wb, `${safeName()}_review.xlsx`);
    toast('Review sheet downloaded.');
  });

  function filtersPayload(){
    return [...rows].sort((a,b)=>a.start-b.start).map((r,i)=>({
      id: i+1,
      start: r.start,
      end: r.end,
      category: r.category,
      original_description: r.description,
      action_type: r.action,
      ...(r.action==='partial_blur' && r.blur_region ? { blur_region: r.blur_region } : {})
    }));
  }

  /* Hand-off to generate_movies_json.html: both pages opened from disk in the same browser share localStorage. */
  document.getElementById('sendToGeneratorBtn').addEventListener('click', ()=>{
    if(!rows.length){ toast('Nothing to send yet.'); return; }
    const id = (typeof stParseId === 'function') ? stParseId(document.getElementById('stImdb').value) : null;
    const handoff = {
      at: Date.now(), title: els.filmTitle.value.trim(),
      imdb: id ? id.imdb : '', season: Number(document.getElementById('stSeason').value) || null, episode: Number(document.getElementById('stEpisode').value) || null,
      filters: filtersPayload()
    };
    try{
      localStorage.setItem('salikStudioHandoff', JSON.stringify(handoff));
      toast(`Sent ${handoff.filters.length} filters. In generate_movies_json.html press "📥 استيراد من Salik Studio".`);
    }catch(e){
      toast('This browser blocked it — use Export Firebase JSON and upload the file in the generator.');
    }
  });

  els.exportJsonBtn.addEventListener('click', ()=>{
    const sorted = [...rows].sort((a,b)=>a.start-b.start);
    const payload = sorted.map((r,i)=>({
      id: i+1,
      start: r.start,
      end: r.end,
      category: r.category,
      original_description: r.description,
      action_type: r.action,
      ...(r.action==='partial_blur' && r.blur_region ? { blur_region: r.blur_region } : {})
    }));
    downloadBlob(JSON.stringify(payload, null, 4), `${safeName()}.json`, 'application/json');
    toast('Firebase-ready JSON downloaded.');
  });

  /* =========================================================
     STATE SNAPSHOT — shared by autosave and Save/Load project file
  ========================================================== */
  function collectState(){
    return {
      subs, rows, totalDuration, uidCounter,
      filmTitle: els.filmTitle.value,
      fileNameLabel: els.fileName.textContent,
      listSingle: document.getElementById('listSingle').value,
      listPhrase: document.getElementById('listPhrase').value,
      listSuggestive: document.getElementById('listSuggestive').value,
      currentFilter, sortDir,
      stremio: (typeof stCollect === 'function') ? (() => { try{ return stCollect(); }catch(e){ return null; } })() : null
    };
  }

  function applyState(state){
    subs = state.subs || [];
    rows = state.rows || [];
    totalDuration = state.totalDuration || 0;
    uidCounter = state.uidCounter || 1;
    if(state.filmTitle) els.filmTitle.value = state.filmTitle;
    if(state.fileNameLabel) els.fileName.textContent = state.fileNameLabel;
    if(state.listSingle) document.getElementById('listSingle').value = state.listSingle;
    if(state.listPhrase) document.getElementById('listPhrase').value = state.listPhrase;
    if(state.listSuggestive) document.getElementById('listSuggestive').value = state.listSuggestive;
    currentFilter = state.currentFilter || 'all';
    sortDir = state.sortDir || 'asc';
    els.processBtn.disabled = subs.length===0;
    document.querySelectorAll('.filter-row button').forEach(b=>{
      b.classList.toggle('active', b.dataset.filter===currentFilter);
    });
    if(state.stremio) setTimeout(() => { try{ stRestore(state.stremio); }catch(e){ console.warn('stremio restore', e); } }, 0);
  }

  /* =========================================================
     SYNC TO PLATFORM CUT — piecewise-linear re-timing using
     2+ reference points (SRT time -> real time on the platform).
     Handles both constant offset / frame-rate stretch AND
     localized differences like an added intro or a trimmed scene,
     as long as you place anchor points around the affected area.
  ========================================================== */
  // Finds the exact original SRT line this row came from and returns its
  // real start timestamp (no estimation involved) — using this instead of
  // the row's own (estimated, per-word) start makes sync anchors reliable
  // even when placed close together.
  function findSubStartForRow(row){
    for(const s of subs){
      if(row.start >= s.start - 0.02 && row.start <= s.end + 0.02){
        return s.start;
      }
    }
    return row.start; // manually-added row with no matching SRT line — fall back
  }

  function buildTimeMapper(anchors){
    const pts = [...anchors].sort((a,b)=>a.orig-b.orig);
    if(pts.length === 1){
      const offset = pts[0].actual - pts[0].orig;
      return t => t + offset;
    }
    return function(t){
      if(t <= pts[0].orig){
        const a = pts[0], b = pts[1];
        const slope = (b.actual-a.actual)/(b.orig-a.orig || 1);
        return a.actual + slope*(t-a.orig);
      }
      if(t >= pts[pts.length-1].orig){
        const a = pts[pts.length-2], b = pts[pts.length-1];
        const slope = (b.actual-a.actual)/(b.orig-a.orig || 1);
        return b.actual + slope*(t-b.orig);
      }
      for(let i=0;i<pts.length-1;i++){
        const a = pts[i], b = pts[i+1];
        if(t>=a.orig && t<=b.orig){
          const slope = (b.actual-a.actual)/(b.orig-a.orig || 1);
          return a.actual + slope*(t-a.orig);
        }
      }
      return t;
    };
  }

  function renderAnchors(){
    els.anchorList.innerHTML = '';
    syncAnchors.forEach((a, i)=>{
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;align-items:center;gap:6px;font-family:IBM Plex Mono,monospace;font-size:11px;color:var(--ink-dim);background:var(--panel-alt);padding:5px 8px;border-radius:2px;';
      row.innerHTML = `<span style="flex:1;">${fmtTime(a.orig)} → ${fmtTime(a.actual)}</span><button data-i="${i}" style="background:transparent;border:none;color:var(--ink-faint);cursor:pointer;font-size:13px;">×</button>`;
      row.querySelector('button').addEventListener('click', ()=>{
        syncAnchors.splice(i,1);
        renderAnchors();
      });
      els.anchorList.appendChild(row);
    });
    els.applySyncBtn.disabled = syncAnchors.length < 1 || (rows.length===0 && subs.length===0);
  }

  els.addAnchorBtn.addEventListener('click', ()=>{
    const orig = parseFloat(els.anchorOrig.value);
    const actual = parseFloat(els.anchorActual.value);
    if(isNaN(orig) || isNaN(actual)){
      toast('Fill in both the SRT time and the actual time first.');
      return;
    }
    syncAnchors.push({orig, actual});
    els.anchorOrig.value = '';
    els.anchorActual.value = '';
    renderAnchors();
  });

  els.applySyncBtn.addEventListener('click', ()=>{
    if(syncAnchors.length===0) return;
    const mapper = buildTimeMapper(syncAnchors);
    subs = subs.map(s=>({...s, start: mapper(s.start), end: mapper(s.end)}));
    let shifted = 0;
    rows = rows.map(r=>{
      if(r.category !== 'language') return r; // manually-placed nudity/violence/substance-abuse cuts stay put
      shifted++;
      return {...r, start: Math.round(mapper(r.start)*100)/100, end: Math.round(mapper(r.end)*100)/100};
    });
    rows.sort((a,b)=>a.start-b.start);
    totalDuration = subs.reduce((max,s)=>Math.max(max, s.end), totalDuration);
    syncAnchors = [];
    renderAnchors();
    render();
    hasUnsavedChanges = true;
    persist();
    toast(`Re-synced ${shifted} language row(s). Other categories were left untouched.`);
  });

  /* =========================================================
     EXACT WORD TIMING — Whisper word timestamps on the real audio.
     Only the lines that hold a Language/mute row are listened to:
     each one is cut from the WAV (read in slices, never loaded whole),
     transcribed with word timings, the muted word is found in what
     was heard, and its edges are tightened on the sound itself.
  ========================================================== */
  const ALIGN_LIB = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.2.0';
  const ALIGN_SR = 16000;
  const alignEls = {
    file: document.getElementById('alignFile'),
    drop: document.getElementById('alignDrop'),
    fileName: document.getElementById('alignFileName'),
    model: document.getElementById('alignModel'),
    lang: document.getElementById('alignLang'),
    padBefore: document.getElementById('alignPadBefore'),
    padAfter: document.getElementById('alignPadAfter'),
    offset: document.getElementById('alignOffset'),
    btn: document.getElementById('alignBtn'),
    stop: document.getElementById('alignStopBtn'),
    status: document.getElementById('alignStatus'),
  };
  let alignWav = null;       // {file, dataStart, dataLen, rate, channels, bits, float, duration}
  let alignAsr = null, alignAsrModel = '';
  let alignStopRequested = false;

  async function parseWav(file){
    const head = new DataView(await file.slice(0, Math.min(file.size, 1 << 20)).arrayBuffer());
    const tag = o => String.fromCharCode(head.getUint8(o), head.getUint8(o+1), head.getUint8(o+2), head.getUint8(o+3));
    if(head.byteLength < 12 || tag(0) !== 'RIFF' && tag(0) !== 'RF64' || tag(8) !== 'WAVE') throw new Error('Not a WAV file');
    let o = 12, fmt = null, dataStart = -1, dataLen = 0;
    while(o + 8 <= head.byteLength){
      const id = tag(o), size = head.getUint32(o+4, true);
      if(id === 'fmt '){
        let format = head.getUint16(o+8, true);
        const channels = head.getUint16(o+10, true), rate = head.getUint32(o+12, true), bits = head.getUint16(o+22, true);
        if(format === 0xFFFE && size >= 40) format = head.getUint16(o+32, true); // WAVE_FORMAT_EXTENSIBLE
        fmt = {format, channels, rate, bits};
      } else if(id === 'data'){
        dataStart = o + 8;
        dataLen = (size === 0xFFFFFFFF || size === 0 || dataStart + size > file.size) ? file.size - dataStart : size;
        break;
      }
      o += 8 + size + (size & 1);
    }
    if(!fmt || dataStart < 0) throw new Error('WAV has no audio data');
    if(!((fmt.format === 1 && (fmt.bits === 16 || fmt.bits === 24 || fmt.bits === 32)) || (fmt.format === 3 && fmt.bits === 32))) throw new Error('Use PCM WAV (the FFmpeg command above makes one)');
    const frameBytes = fmt.channels * fmt.bits / 8;
    return {file, dataStart, dataLen, rate: fmt.rate, channels: fmt.channels, bits: fmt.bits, float: fmt.format === 3, frameBytes, duration: dataLen / frameBytes / fmt.rate};
  }

  // Reads [t0, t1) seconds as mono 16 kHz Float32.
  async function readWavRange(w, t0, t1){
    t0 = Math.max(0, t0); t1 = Math.min(w.duration, t1);
    if(t1 <= t0) return new Float32Array(0);
    const f0 = Math.floor(t0 * w.rate), f1 = Math.ceil(t1 * w.rate);
    const buf = await w.file.slice(w.dataStart + f0 * w.frameBytes, w.dataStart + f1 * w.frameBytes).arrayBuffer();
    const dv = new DataView(buf), n = Math.floor(buf.byteLength / w.frameBytes), bps = w.bits / 8;
    const mono = new Float32Array(n);
    for(let i = 0; i < n; i++){
      let sum = 0;
      for(let c = 0; c < w.channels; c++){
        const p = i * w.frameBytes + c * bps;
        let v;
        if(w.float) v = dv.getFloat32(p, true);
        else if(w.bits === 16) v = dv.getInt16(p, true) / 32768;
        else if(w.bits === 24){ let x = dv.getUint8(p) | (dv.getUint8(p+1) << 8) | (dv.getInt8(p+2) << 16); v = x / 8388608; }
        else v = dv.getInt32(p, true) / 2147483648;
        sum += v;
      }
      mono[i] = sum / w.channels;
    }
    if(w.rate === ALIGN_SR) return mono;
    // resample (box-average when shrinking, linear otherwise)
    const ratio = w.rate / ALIGN_SR, m = Math.floor(n / ratio), out = new Float32Array(m);
    for(let j = 0; j < m; j++){
      const a = j * ratio, b = a + ratio;
      if(ratio > 1){
        let s = 0, k = 0;
        for(let i = Math.floor(a); i < Math.min(n, Math.ceil(b)); i++){ s += mono[i]; k++; }
        out[j] = k ? s / k : 0;
      } else {
        const i = Math.floor(a), fr = a - i;
        out[j] = (mono[i] || 0) * (1 - fr) + (mono[i+1] || 0) * fr;
      }
    }
    return out;
  }

  // Loudness every 10 ms.
  function rmsFrames(x){
    const hop = ALIGN_SR / 100, n = Math.floor(x.length / hop), out = new Float32Array(n);
    for(let i = 0; i < n; i++){
      let s = 0;
      for(let j = i * hop; j < (i + 1) * hop; j++) s += x[j] * x[j];
      out[i] = Math.sqrt(s / hop);
    }
    return out;
  }

  // Fallback when the letter-level aligner can't be used (Arabic): trims silence inside Whisper's word span.
  function refineEdges(env, ws, we){
    if(!env.length) return {start: ws, end: we};
    const sorted = Array.from(env).sort((a,b)=>a-b);
    const floor = sorted[Math.floor(sorted.length * 0.1)] || 0;
    const i0 = Math.max(0, Math.floor(ws * 100)), i1 = Math.min(env.length - 1, Math.ceil(we * 100));
    let peak = 0;
    for(let i = i0; i <= i1; i++) peak = Math.max(peak, env[i]);
    const thr = Math.max(floor * 2, floor + (peak - floor) * 0.12);
    if(peak <= thr) return {start: ws, end: we};
    let s = -1, e = -1;
    for(let i = i0; i <= i1; i++){ if(env[i] >= thr){ s = i; break; } }
    for(let i = i1; i >= i0; i--){ if(env[i] >= thr){ e = i + 1; break; } }
    if(s < 0 || e <= s) return {start: ws, end: we};
    return {start: s / 100, end: e / 100};
  }

  /* Letter-level forced alignment (English): wav2vec2 gives, every 20 ms, how likely each letter is;
     the words Whisper heard are laid on those frames (CTC Viterbi), so each word gets its real
     first and last frame. Much tighter than Whisper's own word times. */
  const CTC_MODEL = 'Xenova/wav2vec2-base-960h';
  let ctc = null;
  async function getCtc(){
    if(ctc) return ctc;
    const lib = (() => { throw new Error('Audio alignment does not run inside the extension: open the standalone Salik_studio.html for it.'); })();
    const processor = await lib.AutoProcessor.from_pretrained(CTC_MODEL);
    const model = await lib.AutoModelForCTC.from_pretrained(CTC_MODEL, {dtype: 'q8'});
    const vocab = (await (await fetch(`https://huggingface.co/${CTC_MODEL}/resolve/main/vocab.json`)).json());
    ctc = {processor, model, vocab};
    return ctc;
  }

  // words: [{w}] in order. Returns [{s, e} | null] in seconds from the clip start.
  async function ctcAlign(audio, words){
    const {processor, model, vocab} = await getCtc();
    const inputs = await processor(audio);
    const {logits} = await model(inputs);
    const [, T, V] = logits.dims;
    const data = logits.data;
    const blank = vocab['<pad>'] ?? 0, sep = vocab['|'];
    // log-softmax per frame
    const lp = new Float32Array(T * V);
    for(let t = 0; t < T; t++){
      let m = -Infinity;
      for(let v = 0; v < V; v++) m = Math.max(m, data[t*V+v]);
      let z = 0;
      for(let v = 0; v < V; v++) z += Math.exp(data[t*V+v] - m);
      const lz = m + Math.log(z);
      for(let v = 0; v < V; v++) lp[t*V+v] = data[t*V+v] - lz;
    }
    // token sequence with word separators; remember which tokens belong to which word
    const tokens = [], owner = [];
    words.forEach((wd, wi) => {
      const letters = wd.w.toUpperCase().replace(/[^A-Z']/g, '').split('').filter(c => vocab[c] !== undefined);
      if(!letters.length) return;
      if(tokens.length && sep !== undefined){ tokens.push(sep); owner.push(-1); }
      for(const c of letters){ tokens.push(vocab[c]); owner.push(wi); }
    });
    const N = tokens.length;
    if(!N || N > T) return words.map(() => null);
    // Viterbi trellis: state j = tokens[0..j) emitted
    const NEG = -1e30;
    const tr = new Float32Array((T + 1) * (N + 1)).fill(NEG);
    const from = new Uint8Array((T + 1) * (N + 1)); // 1 = advanced to a new token at this frame
    tr[0] = 0;
    for(let t = 1; t <= T; t++){
      const row = (t-1)*V;
      for(let j = 0; j <= N; j++){
        // stay: blank, or repeat of the current token
        const stayLp = j > 0 ? Math.max(lp[row+blank], lp[row+tokens[j-1]]) : lp[row+blank];
        const stay = tr[(t-1)*(N+1)+j] + stayLp;
        const adv = j > 0 ? tr[(t-1)*(N+1)+j-1] + lp[row+tokens[j-1]] : NEG;
        if(adv > stay){ tr[t*(N+1)+j] = adv; from[t*(N+1)+j] = 1; }
        else tr[t*(N+1)+j] = stay;
      }
    }
    // backtrack: frame where each token was entered, and the last frame it (not blank) was emitted
    const first = new Int32Array(N).fill(-1), last = new Int32Array(N).fill(-1);
    let j = N;
    for(let t = T; t >= 1 && j >= 0; t--){
      const row = (t-1)*V;
      if(j > 0){
        const tok = tokens[j-1];
        const emitted = from[t*(N+1)+j] === 1 || lp[row+tok] >= lp[row+blank];
        if(emitted){ if(last[j-1] < 0) last[j-1] = t-1; first[j-1] = t-1; }
        if(from[t*(N+1)+j] === 1) j--;
      }
    }
    const frameS = audio.length / ALIGN_SR / T;
    return words.map((_, wi) => {
      let s = Infinity, e = -Infinity;
      for(let k = 0; k < N; k++) if(owner[k] === wi && first[k] >= 0){ s = Math.min(s, first[k]); e = Math.max(e, last[k] + 1); }
      return isFinite(s) ? {s: s * frameS, e: e * frameS} : null;
    });
  }

  const cleanWord = w => normalizeToken(String(w).toLowerCase().replace(/[^\p{L}\p{N}']/gu, ''));
  function wordsMatch(heard, wanted){
    if(!heard || !wanted) return false;
    if(heard === wanted) return true;
    for(const p of ARABIC_PROCLITICS){ if(heard.startsWith(p) && heard.slice(p.length) === wanted) return true; }
    if(wanted.length >= 4 && heard.includes(wanted)) return true;          // "motherfucker" heard for "fucker"
    if(heard.length >= 4 && wanted.includes(heard) && heard.length >= wanted.length - 2) return true; // "fuckin" vs "fucking"
    return editDistance(heard, wanted) <= (wanted.length >= 6 ? 2 : wanted.length >= 4 ? 1 : 0);
  }
  // strict version for two heard words glued together (no "contains" rule)
  const sameWord = (a, b) => a === b || (b.length >= 6 && editDistance(a, b) <= 1);
  function editDistance(a, b){
    const d = Array.from({length: a.length + 1}, (_, i) => [i]);
    for(let j = 1; j <= b.length; j++) d[0][j] = j;
    for(let i = 1; i <= a.length; i++) for(let j = 1; j <= b.length; j++)
      d[i][j] = Math.min(d[i-1][j] + 1, d[i][j-1] + 1, d[i-1][j-1] + (a[i-1] === b[j-1] ? 0 : 1));
    return d[a.length][b.length];
  }

  // Finds `wanted` (one word or a phrase) in the heard words, skipping spans already used.
  function findHeard(heard, wanted, used){
    const parts = wanted.split(/\s+/).map(cleanWord).filter(Boolean);
    if(!parts.length) return null;
    const joined = parts.join('');
    for(let i = 0; i < heard.length; i++){
      if(used.has(i)) continue;
      // phrase or single word, word by word
      let ok = i + parts.length <= heard.length;
      for(let k = 0; ok && k < parts.length; k++) ok = !used.has(i + k) && wordsMatch(heard[i + k].w, parts[k]);
      if(ok) return {i0: i, i1: i + parts.length - 1};
      // "god damn" heard for "goddamn" (or the reverse)
      if(i + 1 < heard.length && !used.has(i + 1) && sameWord(heard[i].w + heard[i + 1].w, joined)) return {i0: i, i1: i + 1};
    }
    return null;
  }

  function setAlignStatus(html){ alignEls.status.style.display = 'block'; alignEls.status.innerHTML = html; }

  async function getAsr(model, onProgress){
    if(alignAsr && alignAsrModel === model) return alignAsr;
    const lib = (() => { throw new Error('Audio alignment does not run inside the extension: open the standalone Salik_studio.html for it.'); })();
    lib.env.allowLocalModels = false;
    const files = {};
    const opts = {
      dtype: {encoder_model: 'fp32', decoder_model_merged: 'q4'},
      progress_callback: p => {
        if(p.status === 'progress' && p.file){ files[p.file] = p.progress || 0; onProgress(Object.values(files).reduce((a,b)=>a+b,0) / Object.keys(files).length); }
      }
    };
    let asr = null;
    if(navigator.gpu){ try{ asr = await lib.pipeline('automatic-speech-recognition', model, {...opts, device: 'webgpu'}); }catch(e){ console.warn('WebGPU failed, using WASM', e); } }
    if(!asr) asr = await lib.pipeline('automatic-speech-recognition', model, {...opts, device: 'wasm'});
    alignAsr = asr; alignAsrModel = model;
    return asr;
  }

  function updateAlignButton(){
    alignEls.btn.disabled = !alignWav || !rows.some(r => r.category === 'language' && r.action === 'mute');
  }

  async function alignRows(){
    const padB = Math.max(0, parseFloat(alignEls.padBefore.value) || 0);
    const padA = Math.max(0, parseFloat(alignEls.padAfter.value) || 0);
    const offset = parseFloat(alignEls.offset.value) || 0;   // table time - WAV time
    const lang = alignEls.lang.value;
    const targets = rows.filter(r => r.category === 'language' && r.action === 'mute');
    if(!targets.length || !alignWav) return;

    // one clip per subtitle line (rows from the same line share it)
    const groups = new Map();
    for(const r of targets){
      const mid = (r.start + r.end) / 2;
      const sub = subs.find(s => mid >= s.start - 0.6 && mid <= s.end + 0.6);
      const key = sub ? sub.start + '|' + sub.end : 'r' + r.uid;
      if(!groups.has(key)) groups.set(key, {from: sub ? sub.start : r.start - 1.5, to: sub ? sub.end : r.end + 1.5, rows: []});
      groups.get(key).rows.push(r);
    }

    alignStopRequested = false;
    alignEls.btn.disabled = true; alignEls.stop.style.display = 'block';
    setAlignStatus('Loading Whisper (first time downloads the model, then it is cached)…');
    let asr;
    try{
      asr = await getAsr(alignEls.model.value, p => setAlignStatus(`Downloading model… ${Math.round(p)}%`));
    }catch(e){
      setAlignStatus('Could not load Whisper: ' + escapeHtmlSafe(e.message || String(e)));
      alignEls.btn.disabled = false; alignEls.stop.style.display = 'none';
      return;
    }

    let done = 0, moved = 0, missed = 0;
    const missedList = [];
    const t0 = Date.now();
    for(const g of groups.values()){
      if(alignStopRequested) break;
      const clipStart = Math.max(0, g.from - offset - 0.6);
      const clipEnd = Math.min(alignWav.duration, Math.min(g.to - offset + 0.6, clipStart + 29.5));
      try{
        const audio = await readWavRange(alignWav, clipStart, clipEnd);
        const res = await asr(audio, {return_timestamps: 'word', ...(lang ? {language: lang, task: 'transcribe'} : {})});
        const heard = (res.chunks || [])
          .map(c => ({w: cleanWord(c.text), s: c.timestamp[0], e: c.timestamp[1] ?? c.timestamp[0]}))
          .filter(h => h.w && isFinite(h.s));
        const env = rmsFrames(audio);
        let letters = null;
        if(lang !== 'arabic' && heard.some(h => /[a-z]/.test(h.w)) && !heard.some(h => /[\u0600-\u06FF]/.test(h.w))){
          try{ letters = await ctcAlign(audio, heard); }catch(e){ console.warn('letter aligner failed, using Whisper times', e); }
        }
        const used = new Set();
        for(const r of g.rows.sort((a,b)=>a.start-b.start)){
          const span = findHeard(heard, r.description, used);
          if(!span){ missed++; missedList.push(r); continue; }
          for(let k = span.i0; k <= span.i1; k++) used.add(k);
          const a0 = letters && letters[span.i0], a1 = letters && letters[span.i1];
          const ref = (a0 && a1 && a1.e > a0.s && Math.abs(a0.s - heard[span.i0].s) < 1.5)
            ? {start: a0.s, end: a1.e}
            : refineEdges(env, heard[span.i0].s, Math.max(heard[span.i1].e, heard[span.i0].s + 0.08));
          r.start = Math.round((clipStart + ref.start - padB + offset) * 100) / 100;
          r.end = Math.round((clipStart + ref.end + padA + offset) * 100) / 100;
          r.timed = 'audio';
          moved++;
        }
      }catch(e){
        console.warn('align failed for a line', e);
        for(const r of g.rows){ missed++; missedList.push(r); }
      }
      done++;
      const eta = Math.round((Date.now() - t0) / done * (groups.size - done) / 1000);
      setAlignStatus(`Listening… ${done}/${groups.size} lines · on the word: ${moved} · not heard: ${missed}${eta ? ` · ~${Math.floor(eta/60)}m ${eta%60}s left` : ''}`);
    }
    rows.sort((a,b)=>a.start-b.start);
    render(); hasUnsavedChanges = true; persist();
    alignEls.stop.style.display = 'none'; updateAlignButton();
    const list = missedList.slice(0, 40).map(r => `${fmtTime(r.start)} ${escapeHtmlSafe(r.description)}`).join('<br>');
    setAlignStatus(`${alignStopRequested ? 'Stopped' : 'Done'}: ${moved} mute(s) moved onto the word (✓ in the table).` +
      (missed ? `<br>${missed} not heard (kept their estimated, padded timing — check them by ear):<br>${list}${missedList.length > 40 ? '<br>…' : ''}` : ''));
    toast(`Aligned ${moved} word(s) to the audio${missed ? `, ${missed} need a manual check` : ''}.`);
  }
  function escapeHtmlSafe(t){ return String(t).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }

  async function loadAlignFile(file){
    if(!file) return;
    try{
      alignWav = await parseWav(file);
      alignEls.fileName.textContent = `${file.name} · ${fmtTime(alignWav.duration)} · ${alignWav.rate} Hz`;
      const subEnd = subs.reduce((m,s)=>Math.max(m, s.end), 0);
      if(subEnd && alignWav.duration + 120 < subEnd) toast('This WAV is shorter than the subtitles — is it the same release?');
    }catch(e){
      alignWav = null;
      alignEls.fileName.textContent = '';
      toast(e.message || 'Could not read this WAV');
    }
    updateAlignButton();
  }
  alignEls.drop.addEventListener('click', e => { if(e.target !== alignEls.file) alignEls.file.click(); });
  alignEls.file.addEventListener('change', e => loadAlignFile(e.target.files[0]));
  alignEls.drop.addEventListener('dragover', e => { e.preventDefault(); alignEls.drop.classList.add('drag'); });
  alignEls.drop.addEventListener('dragleave', () => alignEls.drop.classList.remove('drag'));
  alignEls.drop.addEventListener('drop', e => { e.preventDefault(); alignEls.drop.classList.remove('drag'); loadAlignFile(e.dataTransfer.files[0]); });
  alignEls.btn.addEventListener('click', () => alignRows());
  alignEls.stop.addEventListener('click', () => { alignStopRequested = true; alignEls.stop.style.display = 'none'; });
  document.getElementById('alignCopyCmd').addEventListener('click', () => {
    navigator.clipboard.writeText(document.getElementById('alignCmd').textContent).then(() => toast('Command copied.'), () => {});
  });
  setInterval(updateAlignButton, 1000);

  /* =========================================================
     STREMIO — the film's stream link and its subtitles.
     Subtitles come from the OpenSubtitles add-on Stremio itself uses
     (opensubtitles-v3.strem.io, an open API meant for this). The English
     file feeds the detection; the Arabic one is shown on the video.
  ========================================================== */
  const ST_SUBS_ADDON = 'https://opensubtitles-v3.strem.io';
  let stCurrentUid = null;
  let stStopAt = null;
  let stTabMode = false, stTabId = null, stTabSig = '';   // platform tab (extension side panel only)
  const stEls = {
    imdb: document.getElementById('stImdb'), season: document.getElementById('stSeason'), episode: document.getElementById('stEpisode'),
    fetch: document.getElementById('stFetchSubs'), enSel: document.getElementById('stEnSel'), arSel: document.getElementById('stArSel'),
    useEn: document.getElementById('stUseEn'), url: document.getElementById('stVideoUrl'), play: document.getElementById('stPlay'),
    status: document.getElementById('stStatus'), player: document.getElementById('stPlayer'), video: document.getElementById('stVideo'),
    clock: document.getElementById('stClock'), track: document.getElementById('stTrack'), err: document.getElementById('stErr'),
  };
  const stTracks = { en: null, ar: null };

  function stParseId(text){
    const t = String(text || '');
    const m = t.match(/(tt\d{6,10})(?::(\d+):(\d+))?/g);
    if(!m) return null;
    const last = m[m.length-1].split(':');
    return { imdb: last[0], season: last[1] ? Number(last[1]) : null, episode: last[2] ? Number(last[2]) : null };
  }

  async function stFetchSubs(){
    const id = stParseId(stEls.imdb.value);
    if(!id){ toast('Paste an IMDb id like tt15398776.'); return; }
    if(id.season){ stEls.season.value = id.season; stEls.episode.value = id.episode; }
    const season = Number(stEls.season.value) || null, episode = Number(stEls.episode.value) || null;
    const path = season && episode ? `series/${id.imdb}:${season}:${episode}` : `movie/${id.imdb}`;
    stEls.status.textContent = 'Looking for subtitles…';
    try{
      const data = await (await fetch(`${ST_SUBS_ADDON}/subtitles/${path}.json`)).json();
      const list = (data.subtitles || []);
      const label = s => (s.subtitleFileName || s.movieReleaseName || s.id) + (/sdh|hearing/i.test(s.subtitleFileName||'') ? '  [SDH]' : '');
      const fill = (sel, lang) => {
        const items = list.filter(s => s.lang === lang)
          .sort((a,b) => (/sdh/i.test(a.subtitleFileName||'') - /sdh/i.test(b.subtitleFileName||'')));
        sel.innerHTML = items.length ? items.map(s => `<option value="${escapeAttr(s.url)}">${escapeHtmlSafe(label(s))}</option>`).join('') : '<option value="">— none —</option>';
        return items.length;
      };
      const en = fill(stEls.enSel, 'eng'), ar = fill(stEls.arSel, 'ara');
      stEls.useEn.disabled = !en;
      stEls.status.textContent = `${en} English, ${ar} Arabic. Pick the ones named like your stream's release (same cut = same timing).`;
      if(ar) stLoadTrack('ar');
    }catch(e){
      stEls.status.textContent = 'Could not reach the subtitles add-on: ' + (e.message || e);
    }
  }

  const stTexts = {};   // url -> srt text, saved with the project so it works again without the add-on
  async function stFetchSrt(url){
    if(stTexts[url]) return stTexts[url];
    const r = await fetch(url);
    if(!r.ok) throw new Error('HTTP ' + r.status);
    return (stTexts[url] = (await r.text()).replace(/^\uFEFF/, ''));
  }

  /* Saved with the project: the stream link, the subtitle lists, the chosen ones and their text. */
  function stCollect(){
    const opts = sel => [...sel.options].map(o => ({ v: o.value, t: o.text }));
    const keep = {};
    [stEls.enSel.value, stEls.arSel.value].forEach(u => { if(u && stTexts[u]) keep[u] = stTexts[u]; });
    return { imdb: stEls.imdb.value, season: stEls.season.value, episode: stEls.episode.value, videoUrl: stEls.url.value,
      en: opts(stEls.enSel), ar: opts(stEls.arSel), enSel: stEls.enSel.value, arSel: stEls.arSel.value, track: stEls.track.value, texts: keep };
  }

  function stRestore(st){
    if(!st) return;
    stEls.imdb.value = st.imdb || ''; stEls.season.value = st.season || ''; stEls.episode.value = st.episode || '';
    stEls.url.value = st.videoUrl || '';
    const fill = (sel, list, val) => { sel.innerHTML = (list || []).map(o => `<option value="${escapeAttr(o.v)}">${escapeHtmlSafe(o.t)}</option>`).join(''); if(val) sel.value = val; };
    fill(stEls.enSel, st.en, st.enSel); fill(stEls.arSel, st.ar, st.arSel);
    stEls.useEn.disabled = !stEls.enSel.value;
    Object.assign(stTexts, st.texts || {});
    if(st.track) stEls.track.value = st.track;
    if(stEls.arSel.value) stLoadTrack('ar');
    if(stEls.track.value === 'en' && stEls.enSel.value) stLoadTrack('en');
    if(st.videoUrl){
      stEls.player.style.display = 'block';
      stEls.video.src = st.videoUrl;   // not played until you press play
      stApplyTrack();
      stEls.status.textContent = 'Restored from the project. If Stremio was closed, open the film there again and paste the new stream link.';
    }
  }

  function stToVtt(srt){
    return 'WEBVTT\n\n' + srt.replace(/\r/g,'').replace(/(\d\d:\d\d:\d\d),(\d\d\d)/g, '$1.$2');
  }

  async function stLoadTrack(lang){
    const sel = lang === 'ar' ? stEls.arSel : stEls.enSel;
    if(!sel.value) return;
    try{
      const vtt = stToVtt(await stFetchSrt(sel.value));
      if(stTracks[lang]) URL.revokeObjectURL(stTracks[lang]);
      stTracks[lang] = URL.createObjectURL(new Blob([vtt], { type: 'text/vtt' }));
      stApplyTrack();
    }catch(e){ toast('Could not load the ' + (lang === 'ar' ? 'Arabic' : 'English') + ' subtitles.'); }
  }

  function stApplyTrack(){
    const v = stEls.video;
    v.querySelectorAll('track').forEach(t => t.remove());
    const want = stEls.track.value;
    if(want === 'off' || !stTracks[want]) return;
    const t = document.createElement('track');
    t.kind = 'subtitles'; t.srclang = want; t.label = want === 'ar' ? 'العربية' : 'English'; t.src = stTracks[want]; t.default = true;
    v.appendChild(t);
    // drawn by stCap (above the blur), not by the browser (the blur would cover it)
    const hide = () => { if(t.track && t.track.mode !== 'hidden') t.track.mode = 'hidden'; };
    t.addEventListener('load', () => { hide(); stShowCue(); });
    setTimeout(hide, 50);
    t.track.addEventListener('cuechange', stShowCue);
  }

  const stCap = document.getElementById('stCap');
  function stShowCue(){
    const v = stEls.video;
    const tr = v.querySelector && v.querySelector('track');
    const cues = tr && tr.track && tr.track.activeCues ? [...tr.track.activeCues] : [];
    const text = cues.map(c => c.text).join('\n').replace(/<[^>]*>/g, '').trim();
    if(!text || stEls.track.value === 'off'){ stCap.style.display = 'none'; stCap.dataset.text = ''; return; }
    if(stCap.dataset.text !== text){
      stCap.dataset.text = text;
      stCap.innerHTML = text.split('\n').map(l => `<span>${escapeHtmlSafe(l)}</span>`).join('<br>');
    }
    stCap.style.display = 'block';
    stPlaceCap();
  }
  function stPlaceCap(){
    if(stCap.style.display === 'none') return;
    const v = stLocalVideo0;
    const w = v.clientWidth, h = v.clientHeight;
    if(!w || !h) return;
    // the picture inside the <video> box (letterboxed when the ratios differ)
    const ar = v.videoWidth && v.videoHeight ? v.videoWidth / v.videoHeight : w / h;
    const ph = Math.min(h, w / ar), pTop = v.offsetTop + (h - ph) / 2;
    Object.assign(stCap.style, { left: (v.offsetLeft + w * 0.05) + 'px', width: (w * 0.9) + 'px',
      top: 'auto', bottom: (v.offsetParent ? v.offsetParent.clientHeight - (pTop + ph) + ph * 0.06 + 34 : 40) + 'px',
      fontSize: Math.max(14, Math.round(ph * 0.05)) + 'px' });
  }

  stEls.fetch.addEventListener('click', stFetchSubs);
  stEls.arSel.addEventListener('change', () => stLoadTrack('ar'));
  stEls.enSel.addEventListener('change', () => { if(stEls.track.value === 'en') stLoadTrack('en'); });
  stEls.track.addEventListener('change', async () => { if(stEls.track.value === 'en' && !stTracks.en) await stLoadTrack('en'); stApplyTrack(); });

  stEls.useEn.addEventListener('click', async () => {
    if(!stEls.enSel.value) return;
    try{
      rawSrtText = await stFetchSrt(stEls.enSel.value);
      subs = parseSRT(rawSrtText);
      const name = stEls.enSel.options[stEls.enSel.selectedIndex].text.replace(/\s+\[SDH\]$/, '');
      els.fileName.textContent = `${name} — ${subs.length} lines (from Stremio)`;
      els.processBtn.disabled = subs.length === 0;
      if(!els.filmTitle.value){
        const guess = name.replace(/\.(srt|vtt)$/i,'').replace(/[._]/g,' ').replace(/\b(19|20)\d{2}\b.*$/,'').trim();
        if(guess) els.filmTitle.value = guess;
      }
      toast(`English subtitles loaded (${subs.length} lines). Run the SRT Cleaner first if it's [SDH], then Process subtitles.`);
      stLoadTrack('en');
    }catch(e){ toast('Could not download the English subtitles.'); }
  });

  stEls.play.addEventListener('click', () => {
    const u = stEls.url.value.trim();
    if(!/^https?:\/\//i.test(u)){ toast('Paste the stream link that starts with http.'); return; }
    stEls.err.textContent = '';
    stEls.player.style.display = 'block';
    stEls.video.src = u;
    stApplyTrack();
    stEls.video.play().catch(()=>{});
  });
  stEls.video.addEventListener('error', () => {
    stEls.err.textContent = "The browser can't play this stream (usually AC3/EAC3 audio or HEVC video). In Stremio pick an x264 / H.264 stream with AAC audio.";
  });
  stEls.video.addEventListener('timeupdate', () => { if(stStopAt !== null && stEls.video.currentTime >= stStopAt){ stEls.video.pause(); stStopAt = null; } });
  const stLocalVideo0 = stEls.video;
  window.addEventListener('resize', stPlaceCap);
  document.addEventListener('fullscreenchange', () => setTimeout(stPlaceCap, 100));
  stLocalVideo0.addEventListener('loadedmetadata', stPlaceCap);
  stEls.track.addEventListener('change', stShowCue);
  (function stTick(){ stEls.clock.textContent = fmtSrtTime(stEls.video.currentTime || 0).replace(',', '.'); requestAnimationFrame(stTick); })();

  function stStep(d){ const v = stEls.video; if(!v.src) return; v.pause(); stStopAt = null; v.currentTime = Math.max(0, v.currentTime + d); }
  document.getElementById('stBack1').addEventListener('click', () => stStep(-1));
  document.getElementById('stBack01').addEventListener('click', () => stStep(-0.1));
  document.getElementById('stFwd01').addEventListener('click', () => stStep(0.1));
  document.getElementById('stFwd1').addEventListener('click', () => stStep(1));
  document.getElementById('stPP').addEventListener('click', () => { const v = stEls.video; stStopAt = null; v.paused ? v.play() : v.pause(); });

  function stPlayRow(uid){
    const r = rows.find(x => x.uid === uid);
    const v = stEls.video;
    stCurrentUid = uid;
    els.tableArea.querySelectorAll('tr.st-current').forEach(t => t.classList.remove('st-current'));
    const tr = els.tableArea.querySelector(`tr[data-uid="${uid}"]`);
    if(tr) tr.classList.add('st-current');
    if(!r) return;
    if(!v.src){ toast('Open the video first (Stremio stream link, on the left).'); return; }
    v.currentTime = Math.max(0, r.start - 2); stStopAt = r.end + 1; v.play().catch(()=>{});
    stEls.player.scrollIntoView({ block: 'nearest' });
  }

  function stSetRowTime(field){
    const r = rows.find(x => x.uid === stCurrentUid);
    if(!r){ toast('Press ▶ on a row first.'); return; }
    r[field] = Math.round(stEls.video.currentTime * 100) / 100;
    if(r.end < r.start){ const t = r.start; r.start = r.end; r.end = t; }
    rows.sort((a,b)=>a.start-b.start);
    render(); hasUnsavedChanges = true; persist();
  }
  document.getElementById('stSetStart').addEventListener('click', () => stSetRowTime('start'));
  document.getElementById('stSetEnd').addEventListener('click', () => stSetRowTime('end'));
  document.getElementById('stAnchorNow').addEventListener('click', () => {
    els.anchorActual.value = (Math.round(stEls.video.currentTime * 100) / 100).toFixed(2);
    toast('Actual time filled from the video. Put the SRT time next to it and Add reference point.');
  });

  /* =========================================================
     PREVIEW — apply the table's filters on the video exactly like the
     extension does (skip / mute / blur / partial blur), to check them.
  ========================================================== */
  const ST_LEAD = 0.3, ST_MUTE_LEAD = 0.1;
  const stApplyEl = document.getElementById('stApply');
  const stBadge = document.getElementById('stBadge');
  const stRegion = document.getElementById('stRegion');
  let stWeMuted = false, stUserMuted = false, stLastSkip = { uid: null, at: 0 }, stBadgeTimer = 0;
  let stIntendedMuted = null; // what the preview last set; any other change came from the viewer
  stEls.video.addEventListener('volumechange', () => { if(stEls.video.muted !== stIntendedMuted) stUserMuted = stEls.video.muted; });

  function stFlash(text, keep){
    stBadge.textContent = text; stBadge.style.display = 'block';
    clearTimeout(stBadgeTimer);
    if(!keep) stBadgeTimer = setTimeout(() => { stBadge.style.display = 'none'; }, 1500);
  }

  function stSetMuted(on){
    if(on === stWeMuted) return;
    stWeMuted = on;
    stIntendedMuted = on || stUserMuted;
    stEls.video.muted = stIntendedMuted;
  }

  /* Same convention as the extension engine and the bookmarklet: x/y = top-left corner, all relative to the <video> box. */
  function stPlaceRegion(region){
    const v = stEls.video;
    if(!region){ stRegion.style.display = 'none'; return; }
    const bw = v.clientWidth, bh = v.clientHeight;
    Object.assign(stRegion.style, { display: 'block', left: (v.offsetLeft + region.x * bw) + 'px', top: (v.offsetTop + region.y * bh) + 'px',
      width: (region.width * bw) + 'px', height: (region.height * bh) + 'px' });
  }

  (function stEngine(){
    requestAnimationFrame(stEngine);
    const v = stEls.video;
    if(stTabMode){ stTabSyncFilters(); return; }   // the tab filters itself (content script)
    if(!stApplyEl.checked || !v.src){ if(stWeMuted) stSetMuted(false); v.style.filter = ''; stPlaceRegion(null); return; }
    const t = v.currentTime;
    let skip = null, mute = null, blur = null, pblur = null;
    for(const r of rows){
      const lead = r.action === 'mute' ? ST_MUTE_LEAD : ST_LEAD;
      if(t < r.start - lead || t > r.end) continue;
      if(r.action === 'skip'){ if(!skip || r.end > skip.end) skip = r; }
      else if(r.action === 'mute') mute = mute || r;
      else if(r.action === 'blur') blur = blur || r;
      else if(r.action === 'partial_blur') pblur = pblur || r;
    }
    if(skip && !v.paused){
      const now = performance.now();
      if(stLastSkip.uid !== skip.uid || now - stLastSkip.at > 3000){
        stLastSkip = { uid: skip.uid, at: now };
        v.currentTime = skip.end + 0.05;
        stFlash('⏩ skipped: ' + (skip.description || skip.category));
      }
    }
    stSetMuted(!!mute && !skip);
    v.style.filter = blur && !skip ? 'blur(40px)' : '';
    stPlaceRegion(pblur && !skip && !blur ? (pblur.blur_region || { x: 0.5, y: 0.5, width: 0.3, height: 0.3 }) : null);
    const active = !skip && (mute || blur || pblur);
    if(active) stFlash((mute ? '🔇 ' : '') + (blur ? '🌫 ' : '') + (pblur ? '▣ ' : '') + (active.description || active.category), true);
    else if(stBadge.textContent && !/^⏩/.test(stBadge.textContent)) stBadge.style.display = 'none';
  })();

  /* Timings made elsewhere (importer review page → "تنزيل JSON", a library/<title>.json, the importer's
     unified JSON, or a plain array of filters) become table rows. */
  document.getElementById('stLoadTimings').addEventListener('click', () => document.getElementById('stTimingsFile').click());
  document.getElementById('stTimingsFile').addEventListener('change', async (e) => {
    const f = e.target.files[0]; e.target.value = '';
    if(!f) return;
    let data;
    try{ data = JSON.parse(await f.text()); }catch(err){ toast('Not a JSON file.'); return; }
    const UNI = { sex: 'nudity', nudity: 'nudity', violence: 'violence', gore: 'violence', profanity: 'language', drugs: 'substance abuse' };
    let list = [];
    if(Array.isArray(data)) list = data;
    else if(Array.isArray(data.filters)) list = data.filters;
    else if(Array.isArray(data.segments)) list = data.segments.filter(sg => UNI[sg.category]).map(sg => ({
      start: sg.start, end: sg.end, category: UNI[sg.category], original_description: sg.note || sg.category, action_type: sg.action }));
    const known = ['language', 'nudity', 'violence', 'substance abuse'];
    const fresh = list.filter(x => isFinite(x.start) && isFinite(x.end)).map(x => {
      const cat = known.includes(x.category) ? x.category : (/sex|nud/i.test(x.category) ? 'nudity' : /lang|prof/i.test(x.category) ? 'language' : /drug|subst|alco|smok/i.test(x.category) ? 'substance abuse' : 'violence');
      const row = makeRow(Number(x.start), Number(x.end), cat, x.original_description || x.description || '', x.action_type || x.action || 'skip', x.verified === false ? 'imported (unreviewed)' : 'imported');
      if(x.blur_region) row.blur_region = x.blur_region;
      return row;
    });
    if(!fresh.length){ toast('No timings found in that file.'); return; }
    const replace = rows.length && confirm(`Replace the ${rows.length} rows in the table with these ${fresh.length}? (Cancel = add them)`);
    rows = (replace ? [] : rows).concat(fresh).sort((a,b)=>a.start-b.start);
    if(data.title && !els.filmTitle.value) els.filmTitle.value = data.title;
    const imdb = data.imdb || (data.platforms && data.platforms.stremio && data.platforms.stremio.id);
    if(imdb && !document.getElementById('stImdb').value) document.getElementById('stImdb').value = imdb;
    render(); hasUnsavedChanges = true; persist();
    stApplyEl.checked = true;
    toast(`Loaded ${fresh.length} timings. Open the video: "Apply filters while playing" is on.`);
  });

  /* =========================================================
     BLUR PICKER — the Nazafa Blur Picker bookmarklet, built in: the video
     goes full screen, you drag a box over it, and the region (relative to
     the video box, top-left x/y — the extension's convention) is copied and
     put on the row you last played. Leaving the picker leaves full screen.
  ========================================================== */
  const stStage = document.getElementById('stStage'), stPick = document.getElementById('stPick');
  const stPickBox = document.getElementById('stPickBox'), stPickPanel = document.getElementById('stPickPanel');
  let stPicking = false, stDrag = null;

  function stPickPanelHtml(extra){
    const r = rows.find(x => x.uid === stCurrentUid);
    stPickPanel.innerHTML = '🎯 اسحب بالماوس فوق الجزء اللي عايز تغبّشه.' +
      (r ? `<br><span style="opacity:.8">الصف: ${fmtTime(r.start)} — ${escapeHtmlSafe(r.description || r.category)}</span>` : '<br><span style="opacity:.8">مفيش صف متحدد: الكود هيتنسخ بس.</span>') +
      '<br><span style="opacity:.75">Space تشغيل/إيقاف · ← → ثانية · Shift+← → عُشر ثانية · Esc إنهاء</span>' + (extra || '') +
      '<br><button data-pk="play">⏯</button><button data-pk="done">إنهاء</button>';
  }

  async function stPickStart(){
    if(stTabMode){ stTabSend({ type: 'pick' }); toast('Draw the box on the video in the tab (press F there first for full screen).'); return; }
    if(!stEls.video.src){ toast('Open the video first.'); return; }
    stPicking = true;
    stEls.video.pause();
    stPick.style.display = 'block'; stPickPanel.style.display = 'block'; stPickPanelHtml();
    try{ if(!document.fullscreenElement) await stStage.requestFullscreen(); }catch(e){ /* the picker still works without full screen */ }
  }

  function stPickStop(){
    if(!stPicking) return;
    stPicking = false; stDrag = null;
    stPick.style.display = 'none'; stPickPanel.style.display = 'none'; stPickBox.style.display = 'none';
    if(document.fullscreenElement === stStage) document.exitFullscreen().catch(()=>{});
  }

  document.getElementById('stPickBtn').addEventListener('click', stPickStart);
  document.addEventListener('fullscreenchange', () => { if(!document.fullscreenElement && stPicking) stPickStop(); });
  stPickPanel.addEventListener('mousedown', e => e.stopPropagation());
  stPickPanel.addEventListener('click', e => {
    const b = e.target.closest('button'); if(!b) return;
    if(b.dataset.pk === 'done') stPickStop();
    if(b.dataset.pk === 'play'){ const v = stEls.video; v.paused ? v.play() : v.pause(); }
  });
  stPickPanel.addEventListener('dblclick', stPickStop);

  stPick.addEventListener('mousedown', e => {
    stDrag = { x: e.clientX, y: e.clientY };
    Object.assign(stPickBox.style, { display: 'block', left: e.clientX + 'px', top: e.clientY + 'px', width: '0px', height: '0px' });
    if(stPickBox.parentNode !== stStage) stStage.appendChild(stPickBox);
    e.preventDefault();
  });
  stPick.addEventListener('mousemove', e => {
    if(!stDrag) return;
    Object.assign(stPickBox.style, { left: Math.min(stDrag.x, e.clientX) + 'px', top: Math.min(stDrag.y, e.clientY) + 'px',
      width: Math.abs(e.clientX - stDrag.x) + 'px', height: Math.abs(e.clientY - stDrag.y) + 'px' });
  });
  stPick.addEventListener('mouseup', e => {
    if(!stDrag) return;
    const r = stEls.video.getBoundingClientRect();
    const x1 = Math.min(stDrag.x, e.clientX), y1 = Math.min(stDrag.y, e.clientY), x2 = Math.max(stDrag.x, e.clientX), y2 = Math.max(stDrag.y, e.clientY);
    stDrag = null;
    if(x2 - x1 < 4 || y2 - y1 < 4){ stPickBox.style.display = 'none'; return; }
    const c = n => +Math.max(0, Math.min(1, n)).toFixed(3);
    const region = { x: c((x1 - r.left) / r.width), y: c((y1 - r.top) / r.height), width: c((x2 - x1) / r.width), height: c((y2 - y1) / r.height) };
    const snippet = `"action_type": "partial_blur", "blur_region": ${JSON.stringify(region)}`;
    try{ navigator.clipboard.writeText(snippet); }catch(err){}
    const row = rows.find(x => x.uid === stCurrentUid);
    if(row){
      row.action = 'partial_blur'; row.blur_region = region;
      render(); hasUnsavedChanges = true; persist();
    }
    stPickPanelHtml(`<br>✅ ${row ? 'اتحط على الصف واتنسخ' : 'اتنسخ'}:<br><span style="direction:ltr;display:inline-block;font:11px monospace;background:#1e293b;padding:4px 6px;border-radius:6px;">${escapeHtmlSafe(JSON.stringify(region))}</span><br><span style="opacity:.75">ارسم تاني لو عايز تعدّل.</span>`);
  });
  /* Arrows move the video: → / ← one second, Shift+→ / Shift+← a tenth (also , and .). Not while typing in a field. */
  document.addEventListener('keydown', e => {
    const v = stEls.video;
    if(!v.src) return;
    const typing = e.target.closest && e.target.closest('input, textarea, select, [contenteditable]');
    if(typing && !stPicking) return;
    if(stPicking && e.key === 'Escape'){ stPickStop(); return; }
    let d = 0;
    if(e.key === 'ArrowRight') d = e.shiftKey ? 0.1 : 1;
    else if(e.key === 'ArrowLeft') d = e.shiftKey ? -0.1 : -1;
    else if(e.key === '.') d = 0.1;
    else if(e.key === ',') d = -0.1;
    if(d){ e.preventDefault(); e.stopPropagation(); stStep(d); return; }
    if(stPicking && e.key === ' '){ e.preventDefault(); v.paused ? v.play() : v.pause(); }
  }, true);

  /* =========================================================
     PLATFORM TAB — only inside the Salik Studio extension (side panel).
     The video of the tab next to the panel stands in for the player:
     time, seek, play/pause, the blur picker and the filters preview all
     go to the tab's content script.
  ========================================================== */
  const stExt = typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id && chrome.tabs;
  const stLocalVideo = stEls.video;
  const stTabState = { t: 0, at: 0, paused: true, duration: 0, rate: 1, platform: '' };
  const stTabVideo = {
    src: 'tab',
    get currentTime(){ return stTabState.paused ? stTabState.t : stTabState.t + (performance.now() - stTabState.at) / 1000 * (stTabState.rate || 1); },
    set currentTime(v){ stTabSend({ type: 'seek', t: v }); stTabState.t = v; stTabState.at = performance.now(); },
    get paused(){ return stTabState.paused; },
    get duration(){ return stTabState.duration; },
    play(){ stTabSend({ type: 'play' }); return Promise.resolve(); },
    pause(){ stTabSend({ type: 'pause' }); stTabState.paused = true; },
    muted: false, style: { filter: '' }, videoWidth: 0, videoHeight: 0, clientWidth: 0, clientHeight: 0, offsetLeft: 0, offsetTop: 0,
    addEventListener(){}, querySelectorAll(){ return []; }, appendChild(){}, getBoundingClientRect(){ return { left: 0, top: 0, width: 1, height: 1 }; }
  };

  function stTabSend(msg){
    if(!stExt || stTabId === null) return Promise.resolve(null);
    return new Promise(res => chrome.tabs.sendMessage(stTabId, { ...msg, salikStudio: true }, r => { void chrome.runtime.lastError; res(r || null); }));
  }

  function stTabSyncFilters(){
    const on = stApplyEl.checked;
    const list = on ? rows.map(r => ({ uid: r.uid, start: r.start, end: r.end, action: r.action, region: r.blur_region || null, text: r.description || r.category })) : [];
    const sig = on + JSON.stringify(list);
    if(sig === stTabSig) return;
    stTabSig = sig;
    stTabSend({ type: 'filters', apply: on, rows: list });
  }

  async function stTabConnect(){
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if(!tab){ toast('No tab.'); return; }
    stTabId = tab.id;
    let hello = await stTabSend({ type: 'hello' });
    if(!hello && chrome.scripting){
      try{
        await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['page.js'], world: 'MAIN' });
        await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });
        await new Promise(r => setTimeout(r, 400));
        hello = await stTabSend({ type: 'hello' });
      }catch(e){ /* page not allowed */ }
    }
    const status = document.getElementById('stTabStatus');
    if(!hello || !hello.video){
      stTabId = null;
      status.textContent = hello ? 'Connected, but no video is playing in this tab yet: start the film and try again.' : "Can't reach this tab (only the streaming sites listed in the extension are allowed). Reload the tab and try again.";
      return;
    }
    stTabMode = true; stTabSig = '';
    stLocalVideo.pause();
    stEls.video = stTabVideo;
    stEls.player.style.display = 'block';
    document.getElementById('stStage').style.display = 'none';
    stEls.track.style.display = 'none';
    document.getElementById('stTabLocal').style.display = 'block';
    status.textContent = `Connected to ${hello.platform || 'the tab'} — ${new URL(tab.url).hostname}.`;
    toast('The controls now drive the video in the tab.');
  }

  function stTabDisconnect(){
    stTabSend({ type: 'filters', apply: false, rows: [] });
    stTabMode = false; stTabId = null;
    stEls.video = stLocalVideo;
    document.getElementById('stStage').style.display = '';
    stEls.track.style.display = '';
    document.getElementById('stTabLocal').style.display = 'none';
    document.getElementById('stTabStatus').textContent = '';
  }

  if(stExt){
    document.getElementById('stTabBox').style.display = 'block';
    document.getElementById('stTabConnect').addEventListener('click', stTabConnect);
    document.getElementById('stTabLocal').addEventListener('click', stTabDisconnect);
    chrome.runtime.onMessage.addListener((msg, sender) => {
      if(!msg || msg.salikStudioTab !== true || !sender.tab || sender.tab.id !== stTabId) return;
      if(msg.type === 'state'){
        Object.assign(stTabState, { t: msg.t, paused: msg.paused, duration: msg.duration || stTabState.duration, rate: msg.rate || 1, platform: msg.platform, at: performance.now() });
        if(stStopAt !== null && msg.t >= stStopAt){ stTabVideo.pause(); stStopAt = null; }
      } else if(msg.type === 'region'){
        const row = rows.find(x => x.uid === stCurrentUid);
        const snippet = `"action_type": "partial_blur", "blur_region": ${JSON.stringify(msg.region)}`;
        try{ navigator.clipboard.writeText(snippet); }catch(e){}
        if(row){ row.action = 'partial_blur'; row.blur_region = msg.region; render(); hasUnsavedChanges = true; persist(); toast('Blur box set on the row (and copied).'); }
        else toast('Blur box copied (press ▶ on a row first to put it there).');
      }
    });
  }

  renderAnchors();

  /* =========================================================
     AUTOSAVE — best-effort, only works when this app runs
     inside an environment that provides window.storage.
     Not relied upon when the file is opened directly from disk.
  ========================================================== */
  const STORAGE_KEY = 'project';
  const storageAvailable = (typeof window.storage !== 'undefined');

  async function persist(){
    if(!storageAvailable) return;
    try{
      await window.storage.set(STORAGE_KEY, JSON.stringify(collectState()), false);
    }catch(e){
      console.error('Autosave failed', e);
    }
  }

  async function restore(){
    let restoredAny = false;
    if(storageAvailable){
      try{
        const result = await window.storage.get(STORAGE_KEY, false);
        if(result && result.value){
          applyState(JSON.parse(result.value));
          restoredAny = true;
        }
      }catch(e){
        // no saved session yet, or it couldn't be read — start fresh
      }
    }
    render();
    if(restoredAny && rows.length){
      toast('Restored your previous session.');
    }
  }

  // autosave on title / detection-list edits (fires on blur) — no-op if unavailable
  els.filmTitle.addEventListener('change', persist);
  document.getElementById('listSingle').addEventListener('change', persist);
  document.getElementById('listPhrase').addEventListener('change', persist);
  document.getElementById('listSuggestive').addEventListener('change', persist);

  /* =========================================================
     SAVE / LOAD PROJECT FILE — the reliable way to keep your
     work when opening this app straight from disk, since it
     saves an actual .json file to your computer.
  ========================================================== */
  els.saveProjectBtn.addEventListener('click', ()=>{
    if(!subs.length && !rows.length){
      toast('Nothing to save yet — process a subtitle file first.');
      return;
    }
    downloadBlob(JSON.stringify(collectState(), null, 2), `${safeName()}_project.json`, 'application/json');
    hasUnsavedChanges = false;
    toast('Project file downloaded — keep it to resume later.');
  });

  function rowsFromRecords(records){
    const validActions = new Set(['skip','mute','blur','partial_blur']);
    const newRows = [];
    for(const sr of records){
      const start = parseFloat(sr.start);
      const end = parseFloat(sr.end);
      if(isNaN(start) || isNaN(end)) continue;
      let action = String(sr.action_type || 'mute').trim().toLowerCase();
      if(!validActions.has(action)) action = 'mute';
      const newRow = makeRow(
        start, end,
        String(sr.category || 'language').trim().toLowerCase(),
        String(sr.original_description || ''),
        action,
        String(sr.Full_sentence || sr.full_sentence || '')
      );
      if(action==='partial_blur' && sr.blur_region){
        try{
          newRow.blur_region = typeof sr.blur_region==='string' ? JSON.parse(sr.blur_region) : sr.blur_region;
        }catch(err){ /* تجاهل قيمة blur_region تالفة — تفضل partial_blur من غير منطقة، هتاخد الافتراضية أول ما تُختار تاني */ }
      }
      newRows.push(newRow);
    }
    return newRows;
  }

  els.loadProjectBtn.addEventListener('click', ()=>els.loadProjectInput.click());
  els.loadProjectInput.addEventListener('change', e=>{
    const file = e.target.files[0];
    if(!file) return;
    const isXlsx = file.name.toLowerCase().endsWith('.xlsx');
    const reader = new FileReader();

    if(isXlsx){
      reader.onload = evt=>{
        try{
          if(typeof XLSX === 'undefined'){
            toast('Excel library failed to load — check your internet connection and try again.');
            return;
          }
          const wb = XLSX.read(evt.target.result, {type:'array'});
          const sheet = wb.Sheets[wb.SheetNames[0]];
          const sheetRows = XLSX.utils.sheet_to_json(sheet, {defval:''});
          if(!sheetRows.length){
            toast('That Excel file looks empty.');
            return;
          }
          const newRows = rowsFromRecords(sheetRows);
          if(!newRows.length){
            toast('Could not find any valid rows (need at least start/end columns) in that Excel file.');
            return;
          }
          rows = newRows.sort((a,b)=>a.start-b.start);
          totalDuration = Math.max(totalDuration, rows.reduce((max,r)=>Math.max(max, r.end), 0));
          els.fileName.textContent = `${file.name} — imported from Excel`;
          render();
          hasUnsavedChanges = true;
          persist();
          toast(`Imported ${rows.length} rows from Excel.`);
        }catch(err){
          toast('Could not read that Excel file.');
        }
      };
      reader.onerror = ()=> toast('Could not read that Excel file.');
      reader.readAsArrayBuffer(file);
    }else{
      reader.onload = evt=>{
        try{
          const parsed = JSON.parse(evt.target.result);
          if(Array.isArray(parsed)){
            // this is a "Firebase JSON" export (flat array of rows), not a full project save
            const newRows = rowsFromRecords(parsed);
            if(!newRows.length){
              toast('Could not find any valid rows (need start/end fields) in that JSON file.');
              return;
            }
            rows = newRows.sort((a,b)=>a.start-b.start);
            totalDuration = Math.max(totalDuration, rows.reduce((max,r)=>Math.max(max, r.end), 0));
            els.fileName.textContent = `${file.name} — imported from Firebase JSON`;
            render();
            hasUnsavedChanges = true;
            persist();
            toast(`Imported ${rows.length} rows from JSON.`);
          }else{
            applyState(parsed);
            render();
            hasUnsavedChanges = false;
            persist();
            toast('Project restored from file.');
          }
        }catch(err){
          toast('Could not read that project file.');
        }
      };
      reader.onerror = ()=> toast('Could not read that project file.');
      reader.readAsText(file);
    }
    els.loadProjectInput.value = '';
  });

  els.clearSessionBtn.addEventListener('click', async ()=>{
    subs = []; rows = []; totalDuration = 0; uidCounter = 1;
    currentFilter = 'all'; sortDir = 'asc';
    els.fileName.textContent = '';
    els.filmTitle.value = 'untitled';
    els.processBtn.disabled = true;
    document.getElementById('listSingle').value = DEFAULT_SINGLE.join('\n');
    document.getElementById('listPhrase').value = DEFAULT_PHRASE.join('\n');
    document.getElementById('listSuggestive').value = DEFAULT_SUGGESTIVE.join('\n');
    document.querySelectorAll('.filter-row button').forEach(b=>b.classList.toggle('active', b.dataset.filter==='all'));
    cleanerResultData = null;
    els.cleanerFileName.textContent = '';
    els.cleanerResult.style.display = 'none';
    els.cleanerResult.innerHTML = '';
    els.cleanerActions.style.display = 'none';
    els.cleanerFileInput.value = '';
    hasUnsavedChanges = false;
    render();
    if(storageAvailable){
      try{ await window.storage.delete(STORAGE_KEY, false); }catch(e){ /* nothing saved yet */ }
    }
    toast('Saved session cleared.');
  });

  window.addEventListener('beforeunload', e=>{
    if(hasUnsavedChanges){
      e.preventDefault();
      e.returnValue = '';
    }
  });

  const scrollTopBtn = document.getElementById('scrollTopBtn');
  window.addEventListener('scroll', ()=>{
    scrollTopBtn.classList.toggle('show', window.scrollY > 400);
  });
  scrollTopBtn.addEventListener('click', ()=>{
    window.scrollTo({top: 0, behavior: 'smooth'});
  });

  restore();
})();
