import fs from 'fs/promises'
import path from 'path'
import config from '../../config.js'

const pluginConfig = {
  name: 'menu',
  alias: ['help', 'allmenu', 'menu1', 'info', 'setmenu'],
  category: 'main',
  description: 'Menampilkan menu & daftar fitur bot',
  usage: '.menu | .menu <kategori> | .allmenu | .info | .setmenu <1|2>',
  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 3,
  energi: 0,
  isEnabled: true,
}

function isOwnerSender(sender = '') {
  const owners = [config.owner_wa, config.owner_lid].filter(Boolean)
  return owners.some(n => sender.includes(n))
}

function getGreeting() {
  const hour = Number(
    new Date().toLocaleString('en-US', { timeZone: 'Asia/Jakarta', hour: '2-digit', hour12: false })
  )
  if (hour >= 4 && hour < 11) return 'Pagi ! 🌄'
  if (hour >= 11 && hour < 15) return 'Siang ! ☀️'
  if (hour >= 15 && hour < 18) return 'Sore ! 🌅'
  return 'Malam ! 🌙'
}

function getDateTime() {
  const now = new Date()
  const time = new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  }).format(now).replace(/:/g, '.')
  const date = new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  }).format(now)
  return { time, date }
}

// ── Style menu (1 = simple, 2 = tree + alias) — diset owner via .setmenu, disimpan biar nempel walau restart ──
const STYLE_FILE = path.join(process.cwd(), 'database', 'menu', 'style.json')

async function loadMenuStyle() {
  try {
    const raw = JSON.parse(await fs.readFile(STYLE_FILE, 'utf8'))
    return raw.style === 2 ? 2 : 1
  } catch {
    return 1
  }
}

async function saveMenuStyle(style) {
  await fs.mkdir(path.dirname(STYLE_FILE), { recursive: true })
  await fs.writeFile(STYLE_FILE, JSON.stringify({ style }, null, 2), 'utf8')
}

// Daftar command yang beneran aktif & jalan. Diupdate manual tiap ada
// plugin baru — sengaja gak auto-scan folder plugins/ biar command yang
// belum siap (masih nunggu dependency dll) gak ikut ditampilkan ke user.
const MENU_SECTIONS = [
  {
    key: 'canvas',
    title: '🖼️ CANVAS & MAKER',
    items: [
      ['buatquotes', 'bq | quoteanime', 'Buat quote anime custom'],
      ['fakebankjago', '-', 'Bikin fake chat/notif bank'],
      ['igstory', 'igstorypost', 'Simulasi post IG Story'],
      ['iqc', 'qc2', 'Fake quote iOS style'],
      ['iqcpink', '-', 'Fake quote iOS style (pink)'],
      ['fakeml', 'mlbbfake | mlcard | mlfake', 'Bikin kartu profile ala Mobile Legends'],
    ],
  },
  {
    key: 'ai',
    title: '🤖 AI',
    items: [
      ['text2img2', 't2i2 | genimg', 'Generate gambar dari teks'],
      ['dpsteai', 'dpste | dipasteai', 'Chat AI dipastebin (session per-user)'],
    ],
  },
  {
    key: 'fun',
    title: '😄 FUN',
    items: [
      ['pakustad', 'tanyaustad', 'Tanya pak ustad (gambar)'],
      ['akankah', 'apakah | bagaimana | berapa | bisakah | dimana | haruskah | kapan | mengapa | coba', 'Tanya bot, jawaban random'],
      ['mimpi', '-', 'Tafsir mimpi random'],
      ['rate', '-', 'Rating random buat sesuatu/seseorang'],
      ['soulmatch', '-', 'Cek kecocokan jiwa dua nama'],
      ['puisi', 'sajak', 'Puisi random'],
      ['senja', 'katacinta', 'Kata-kata senja/romantis random'],
      ['fuckmylife', 'fml', 'Cerita FML random'],
      ['meme', 'randommeme', 'Meme Indonesia random (gambar)'],
      ['lahelu', '-', 'Gambar/video lahelu random'],
      ['barandom', 'ba', 'Gambar Blue Archive random'],
      ['quotesimage', 'qimg', 'Gambar quotes random'],
    ],
  },
  {
    key: 'primbon',
    title: '🔮 PRIMBON',
    items: [
      ['zodiak', 'horoscope | ramalan', 'Ramalan zodiak'],
      ['artinama', '-', 'Arti sebuah nama'],
      ['tafsirmimpi', 'artimimpi', 'Tafsir mimpi berdasar kata kunci'],
      ['ramalanjodoh', '-', 'Ramalan jodoh'],
      ['kecocokannamapasangan', '-', 'Cek kecocokan nama pasangan'],
      ['nomerhoki', '-', 'Nomor hoki'],
      ['potensipenyakit', '-', 'Potensi penyakit dari nama/tanggal lahir'],
      ['sifatusahabisnis', '-', 'Sifat usaha/bisnis dari nama'],
    ],
  },
  {
    key: 'islami',
    title: '☪️ ISLAMI',
    items: [
      ['quran', 'surah | alquran', 'Baca ayat Al-Quran per surah'],
      ['murrotal', 'quraudio', 'Audio murottal per surah'],
      ['audioquran', 'audio-quran', 'Cari audio Quran per Qari (mp3quran)'],
      ['islami', 'doa | niatsholat | asmaulhusna', 'Kumpulan fitur Islami'],
    ],
  },
  {
    key: 'berita',
    title: '📰 BERITA',
    items: [
      ['berita', 'antara | cnn | cnbc | sindonews', 'Berita dari berbagai sumber'],
    ],
  },
  {
    key: 'info',
    title: 'ℹ️ INFO',
    items: [
      ['gempa', 'bmkg | infogempa', 'Info gempa terkini BMKG'],
      ['jadwalbola', 'bola | football', 'Jadwal pertandingan bola'],
      ['livescore', 'skor | livebola', 'Skor bola live'],
      ['bluearchive-char', 'bachar', 'Info karakter Blue Archive'],
      ['gag', 'growagarden', 'Stok item Grow a Garden'],
      ['gag2', 'growagarden2', 'Stok GAG + mode watch'],
      ['harilibur', 'libur', 'Hari libur & nasional mendatang'],
      ['infotourney', 'tourney', 'Info turnamen Mobile Legends'],
    ],
  },
  {
    key: 'utility',
    title: '🛠️ UTILITY',
    items: [
      ['ping', 'speed | p', 'Cek respons bot'],
      ['sh', 'search', 'Shell / pencarian'],
      ['ssweb', 'ss | webss', 'Screenshot website'],
    ],
  },
  {
    key: 'owner',
    title: '👑 OWNER',
    items: [
      ['ai {provider}', '-', 'Ganti AI provider global'],
      ['self', '-', 'Toggle mode privat (hanya owner)'],
      ['ds', '-', 'Disconnect sementara'],
      ['setoken {token}', '-', 'Simpan token Vercel'],
      ['deploy', 'vercel', 'Deploy HTML ke Vercel'],
      ['setchangelog', '-', 'Set grup ini jadi target changelog'],
      ['changelog {isi}', 'cl', 'Kirim pengumuman ke grup target changelog'],
      ['unsetchangelog', '-', 'Hapus target changelog'],
      ['setmenu {1|2}', '-', 'Ganti tampilan menu (simple/tree)'],
    ],
  },
]

const totalCmd = MENU_SECTIONS.reduce((n, s) => n + s.items.length, 0)
const totalKategori = MENU_SECTIONS.length

function findSection(keyOrTitle) {
  const q = keyOrTitle.toLowerCase().trim()
  return MENU_SECTIONS.find(s => s.key === q || s.title.toLowerCase().includes(q))
}

function formatItemLines(item, prefix, style) {
  const [cmd, aliasStr, desc] = item
  const primary = `${prefix}${cmd}`
  if (style !== 2) {
    return `  ➭ ${primary} — ${desc}`
  }
  const aliases = aliasStr === '-' ? [] : aliasStr.split('|').map(a => a.trim())
  const lines = [`  ➭ ${primary} — ${desc}`]
  aliases.forEach((alias, i) => {
    const isLast = i === aliases.length - 1
    const treeChar = isLast ? '     └─ ' : '     ├─ '
    lines.push(`${treeChar}${prefix}${alias}`)
  })
  return lines.join('\n')
}

function buildSectionBlock(section, prefix, style) {
  let block = `┌─「 ${section.title} • ${section.items.length} 」\n`
  block += section.items.map(item => formatItemLines(item, prefix, style)).join('\n') + '\n'
  block += `└────────────────`
  return block
}

function buildOverviewText(m) {
  const prefix = m.prefix || '.'
  const namaBot = config.nama_ai || 'Nova AI'
  const { time, date } = getDateTime()

  let out = `✦═══════════════✦\n`
  out += `  👋 Hi, ${m.pushName || 'Kak'}\n`
  out += `✦═══════════════✦\n`
  out += `Selamat ${getGreeting()}\n`
  out += `📅 ${date}\n`
  out += `⏰ ${time} WIB\n\n`
  out += `⚙️ Total Fitur   : ${totalCmd}\n`
  out += `🗂️ Total Kategori: ${totalKategori}\n`
  out += `⌗ Prefix        : [ ${prefix} ]\n\n`
  out += `📚 *Daftar Kategori*\n\n`
  for (const s of MENU_SECTIONS) {
    out += `${s.title} — ${s.items.length} fitur (\`${prefix}menu ${s.key}\`)\n`
  }
  out += `\nKetik *${prefix}allmenu* buat liat semua command, atau *${prefix}menu <kategori>* buat liat command dari kategori tertentu.\n\n`
  out += `> *${namaBot}*`
  return out
}

function buildCategoryText(m, section, style) {
  const prefix = m.prefix || '.'
  const namaBot = config.nama_ai || 'Nova AI'
  let out = `╭───「 📚 *${section.title}* 」\n`
  out += `│ ${section.items.length} fitur tersedia\n`
  out += `╰────────────────\n\n`
  out += buildSectionBlock(section, prefix, style)
  out += `\n\n> *${namaBot}*`
  return out
}

function buildAllMenuText(m, style) {
  const prefix = m.prefix || '.'
  const namaBot = config.nama_ai || 'Nova AI'

  let out = `✦═══════════════✦\n`
  out += `   📚 *ALL MENU* 📚\n`
  out += `✦═══════════════✦\n`
  out += `✨ ${namaBot}\n`
  out += `⚙️ ${totalCmd} fitur • 🗂️ ${totalKategori} kategori\n`
  out += `⌗ Prefix: [ ${prefix} ]\n\n`
  for (const section of MENU_SECTIONS) {
    out += buildSectionBlock(section, prefix, style) + '\n\n'
  }
  out = out.trim() + `\n\n✦═══════════════✦\n> *${namaBot}*`
  return out
}

function buildInfoText(m) {
  const prefix = m.prefix || '.'
  const namaBot = config.nama_ai || 'Nova AI'
  const { time, date } = getDateTime()

  let out = `✦═══════════════✦\n`
  out += `   ℹ️ *BOT INFO* ℹ️\n`
  out += `✦═══════════════✦\n`
  out += `Aku adalah *${namaBot}*, asisten\n`
  out += `virtual WhatsApp berbasis Node.js\n\n`
  out += `📅 Tanggal   : ${date}\n`
  out += `⏰ Waktu     : ${time} WIB\n`
  out += `⚙️ Fitur     : ${totalCmd}\n`
  out += `🗂️ Kategori  : ${totalKategori}\n`
  out += `⌗ Prefix    : [ ${prefix} ]\n\n`
  out += `✦═══════════════✦\n`
  out += `> *${namaBot}*`
  return out
}

async function handler(m) {
  const cmd = m.command
  const text = (m.text || '').trim()

  // ── .setmenu <1|2> — owner only ──
  if (cmd === 'setmenu') {
    if (!isOwnerSender(m.sender)) return m.reply('Fitur ini khusus owner.')
    const styleNum = parseInt(text)
    if (styleNum !== 1 && styleNum !== 2) {
      return m.reply(`Format salah.\nContoh: \`${m.prefix}setmenu 1\` atau \`${m.prefix}setmenu 2\``)
    }
    await saveMenuStyle(styleNum)
    return m.reply(`✅ Berhasil mengubah tipe menu menjadi Tipe ${styleNum}.`)
  }

  // ── .info — kartu info bot ──
  if (cmd === 'info') {
    return m.reply(buildInfoText(m))
  }

  const style = await loadMenuStyle()

  // ── .allmenu — semua kategori + semua command ──
  if (cmd === 'allmenu') {
    return m.reply(buildAllMenuText(m, style))
  }

  // ── .menu <kategori> / .help <kategori> / .menu1 <kategori> ──
  if (text) {
    const section = findSection(text)
    if (section) return m.reply(buildCategoryText(m, section, style))
    // teks gak cocok kategori manapun — jatuh ke overview biar tetap kebantu, bukan diem aja
  }

  // ── .menu / .help / .menu1 (tanpa argumen) — overview kategori ──
  return m.reply(buildOverviewText(m), { mentions: [m.sender] })
}

export { pluginConfig as config, handler }
