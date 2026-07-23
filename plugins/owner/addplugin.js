import fs from 'fs/promises'
import path from 'path'
import { exec } from 'child_process'
import { promisify } from 'util'
import config from '../../config.js'

const execAsync = promisify(exec)

// ── /addplugin — tulis & aktifin plugin baru langsung dari WA, gak perlu upload manual ke GitHub ──
const pluginConfig = {
    name: 'addplugin',
    alias: ['newplugin'],
    category: 'owner',
    description: 'Tulis file plugin baru ke plugins/<kategori>/<nama>.js langsung dari WA',
    usage: '.addplugin <kategori>/<nama>\\n<kode plugin>  (atau reply pesan/file berisi kode)',
    example: '.addplugin ai/tebakgambar',
    isOwner: true,
    isEnabled: true,
}

const PLUGIN_DIR = path.join(process.cwd(), 'plugins')
const TMP_DIR = path.join(process.cwd(), 'database', 'addplugin')

function isOwnerSender(sender = '') {
    const owners = [config.owner_wa, config.owner_lid].filter(Boolean)
    return owners.some(n => sender.includes(n))
}

function stripFence(code) {
    return code.trim()
        .replace(/^```[a-zA-Z0-9]*\n?/, '')
        .replace(/```$/, '')
        .trim()
}

async function handler(m) {
    if (!isOwnerSender(m.sender)) {
        return m.reply('❌ *Khusus owner.*')
    }

    const raw = m.text || ''
    const firstNewline = raw.indexOf('\n')
    const headerLine = (firstNewline === -1 ? raw : raw.slice(0, firstNewline)).trim()

    if (!headerLine) {
        return m.reply(
`🧩 *ADDPLUGIN*

Tulis/tempel plugin baru langsung dari WA, gak perlu upload ke GitHub manual.

*Format:*
\`${m.prefix}addplugin <kategori>/<namafile>\`
lanjut baris berikutnya isi kode plugin-nya

*Atau:* reply pesan yang isinya kode / file .js, terus kirim \`${m.prefix}addplugin <kategori>/<namafile>\`

*Atau:* kirim file .js dengan caption \`${m.prefix}addplugin <kategori>/<namafile>\`

*Contoh:*
\`${m.prefix}addplugin ai/tebakgambar\`
\`\`\`
const pluginConfig = { name: 'tebakgambar', ... }
...
export { pluginConfig as config, handler }
\`\`\``
        )
    }

    const match = headerLine.match(/^([a-z0-9_-]+)\/([a-z0-9_-]+)$/i)
    if (!match) {
        return m.reply(`❌ Format salah. Contoh: \`${m.prefix}addplugin ai/tebakgambar\` (kategori/namafile, huruf/angka/dash/underscore doang).`)
    }
    const category = match[1].toLowerCase()
    const filename = match[2].toLowerCase() + '.js'

    // ── ambil kode dari: file terlampir > reply file > reply teks > isi pesan setelah baris pertama ──
    let code = null
    try {
        if (m.isMedia && m.type === 'documentMessage') {
            code = (await m.download()).toString('utf8')
        } else if (m.quoted?.filename && m.quoted?.mimetype) {
            code = (await m.quoted.download()).toString('utf8')
        } else if (m.quoted?.text) {
            code = m.quoted.text
        } else if (firstNewline !== -1) {
            code = raw.slice(firstNewline + 1)
        }
    } catch (e) {
        return m.reply(`❌ Gagal ambil source code: ${e.message}`)
    }

    if (!code || !code.trim()) {
        return m.reply('❌ Gak ada kode yang kedeteksi. Tempel kode setelah baris pertama, reply pesan/file berisi kode, atau kirim sebagai file .js dengan caption command ini.')
    }

    code = stripFence(code)
    if (!code) {
        return m.reply('❌ Kode kosong setelah dibersihin dari format markdown.')
    }

    m.react('⏳')

    const finalPath = path.join(PLUGIN_DIR, category, filename)
    const alreadyExists = await fs.access(finalPath).then(() => true).catch(() => false)

    await fs.mkdir(TMP_DIR, { recursive: true })
    const tmpPath = path.join(TMP_DIR, `check_${Date.now()}_${filename}`)
    await fs.writeFile(tmpPath, code, 'utf8')

    // ── validasi syntax dulu SEBELUM nyentuh folder plugins/ asli ──
    try {
        await execAsync(`node --check "${tmpPath}"`)
    } catch (e) {
        await fs.unlink(tmpPath).catch(() => {})
        m.react('❌')
        const errMsg = (e.stderr || e.message || '').toString().slice(0, 800)
        return m.reply(`❌ *Syntax error*, plugin GAK disimpan:\n\n\`\`\`\n${errMsg}\n\`\`\``)
    }

    const hasExport = /export\s*\{[^}]*config[^}]*handler[^}]*\}/.test(code) || /export\s+default\s*\{/.test(code)
    const warnExport = hasExport ? '' : '\n\n⚠️ *Note:* gak kedeteksi `export { config, handler }` atau `export default {...}` — coba dicek lagi, biasanya plugin gak bakal ke-load kalau formatnya salah.'

    await fs.mkdir(path.join(PLUGIN_DIR, category), { recursive: true })
    await fs.rename(tmpPath, finalPath)

    if (alreadyExists) {
        m.react('♻️')
        return m.reply(
`♻️ *Plugin berhasil ditimpa:* \`plugins/${category}/${filename}\`

⚠️ Ini nimpa plugin yang udah pernah kepake sebelumnya — Node nyimpen cache modul lama, jadi *WAJIB restart bot* biar versi barunya kepake.${warnExport}`
        )
    }

    try {
        if (typeof global.__novaReloadPlugins === 'function') {
            await global.__novaReloadPlugins()
            m.react('✅')
            return m.reply(`✅ *Plugin baru aktif:* \`plugins/${category}/${filename}\`\n\nLangsung bisa dicoba sekarang, gak perlu restart.${warnExport}`)
        }
    } catch (e) {
        // reload gagal → tetep kesimpen di disk, minta restart manual
    }

    m.react('✅')
    return m.reply(`✅ *Plugin tersimpan:* \`plugins/${category}/${filename}\`\n\nRestart bot buat aktifin.${warnExport}`)
}

export { pluginConfig as config, handler }
