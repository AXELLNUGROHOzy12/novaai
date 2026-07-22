/**
 * ═══════════════════════════════════════════════════════════
 * TEMP MAIL GENERATOR
 * ═══════════════════════════════════════════════════════════
 * Author    : DEFAN
 * Website   : dipastebin.web.id
 * Channel   : whatsapp.com/channel/0029Vb89qIx1XquQoXgzdd2m
 * Base      : generator.email
 * (diadaptasi dari script CLI ke plugin Nova, logic inti gak diubah)
 * ═══════════════════════════════════════════════════════════
 */
import * as cheerio from 'cheerio'
import axios from 'axios'
import fs from 'fs/promises'
import path from 'path'

const pluginConfig = {
    name: 'tempmail',
    alias: ['mailgen', 'gmailfake', 'checkmail', 'inbox'],
    category: 'tools',
    description: 'Generate email sementara & cek inbox-nya (generator.email)',
    usage: '.tempmail [domain] | .checkmail [email]',
    example: '.tempmail | .checkmail',
    isEnabled: true
}

const genConfig = {
    apiBase: 'https://generator.email/',
    apiValidate: 'check_adres_validation3.php',
    maxRetry: 5,
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
    }
}

const utils = {
    sleep: (ms) => new Promise(resolve => setTimeout(resolve, ms)),
    parseEmail: (email) => email?.includes('@') ? email.split('@') : null,
    extractLinks: ($, ctx, selector) => {
        const links = []
        ctx(selector + ' a').each((i, el) => {
            let href = ctx(el).attr('href')
            if (href) {
                if (!href.startsWith('http')) href = new URL(href, genConfig.apiBase).href
                links.push(href)
            }
        })
        return links
    }
}

class HttpClient {
    constructor() {
        this._cookie = ''
        this.client = axios.create({
            timeout: 15000,
            maxRedirects: 5,
            validateStatus: (status) => status >= 200 && status < 400
        })
    }

    async fetch(url, options = {}) {
        for (let i = 0; i < genConfig.maxRetry; i++) {
            try {
                const headers = { ...genConfig.headers, ...options.headers }
                if (this._cookie) headers['Cookie'] = this._cookie

                const response = await this.client({
                    url,
                    method: options.method || 'GET',
                    headers,
                    data: options.body || null,
                    responseType: 'text'
                })

                this._handleCookie(response)

                if (!options._t) {
                    try {
                        return JSON.parse(response.data)
                    } catch {
                        return response.data
                    }
                }
                return response.data
            } catch (err) {
                if (i === genConfig.maxRetry - 1) {
                    throw new Error(err.response ? `Server responded with ${err.response.status}` : err.message)
                }
                await utils.sleep(1000)
            }
        }
    }

    _handleCookie(response) {
        const setCookie = response.headers['set-cookie']
        if (setCookie && setCookie.length > 0) {
            const cookieStr = setCookie.join(';')
            const match = cookieStr.match(/surl=([^;]+)/)
            if (match) this._cookie = `surl=${match[1]}`
        }
    }
}

class EmailGenerator {
    constructor() {
        this.http = new HttpClient()
    }

    async validateAddress(username, domain) {
        try {
            const params = new URLSearchParams({ usr: username, dmn: domain })
            return await this.http.fetch(genConfig.apiBase + genConfig.apiValidate, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: params.toString()
            })
        } catch (error) {
            return { err: error.message }
        }
    }

    async generate(domain = '') {
        try {
            const initUrl = domain ? genConfig.apiBase + domain : genConfig.apiBase
            await this.http.fetch(initUrl, { _t: 1 })
            const html = await this.http.fetch(genConfig.apiBase, { _t: 1 })

            const $ = cheerio.load(html)
            const email = $('#email_ch_text').text()?.trim()

            if (!email) {
                return { success: false, result: 'Gagal men-generate email (Elemen HTML tidak ditemukan)' }
            }

            const [username, emailDomain] = utils.parseEmail(email)
            const validation = await this.validateAddress(username, emailDomain)

            return {
                success: true,
                result: {
                    email,
                    emailStatus: validation.status || null,
                    uptime: validation.uptime || null,
                    ...(validation.err && { error: validation.err })
                }
            }
        } catch (error) {
            return { success: false, result: error.message }
        }
    }

    async getInbox(email) {
        const parsed = utils.parseEmail(email)
        if (!parsed) return { success: false, result: 'Email tidak boleh kosong' }

        const [username, domain] = parsed
        const validation = await this.validateAddress(username, domain)
        const cookieValue = `surl=${domain}/${username}`

        let html
        try {
            html = await this.http.fetch(genConfig.apiBase, { headers: { Cookie: cookieValue }, _t: 1 })
        } catch (error) {
            return {
                success: true,
                result: { email, emailStatus: validation.status, uptime: validation.uptime, inbox: [], error: error.message }
            }
        }

        if (html.includes('Email generator is ready')) {
            return { success: true, result: { email, emailStatus: validation.status, uptime: validation.uptime, inbox: [] } }
        }

        const $ = cheerio.load(html)
        const messageCount = parseInt($('#mess_number').text()) || 0
        const inbox = []

        if (messageCount === 1) {
            inbox.push(this._parseSingleMessage($))
        } else if (messageCount > 1) {
            inbox.push(...await this._parseMultipleMessages($))
        }

        return { success: true, result: { email, emailStatus: validation.status, uptime: validation.uptime, inbox } }
    }

    _parseSingleMessage($) {
        const element = $('#email-table .e7m.row')
        const spans = element.find('.e7m.col-md-9 span')
        const messageBody = element.find('.e7m.mess_bodiyy')
        const links = utils.extractLinks($, $, '.e7m.mess_bodiyy')

        return {
            from: spans.eq(3).text().replace(/\(.*?\)/, '').trim(),
            to: spans.eq(1).text(),
            created: element.find('.e7m.tooltip').text().replace('Created: ', ''),
            subject: element.find('h1').text(),
            message: messageBody.text().trim(),
            links
        }
    }

    async _parseMultipleMessages($) {
        const messages = []
        const messageLinks = $('#email-table a').map((_, a) => $(a).attr('href')).get()

        for (const link of messageLinks) {
            const html = await this.http.fetch(genConfig.apiBase + link, {
                headers: { Cookie: `surl=${link.replace('/', '')}` },
                _t: 1
            })

            const $message = cheerio.load(html)
            const spans = $message('.e7m.col-md-9 span')
            const messageBody = $message('.e7m.mess_bodiyy')
            const links = utils.extractLinks($message, $message, '.e7m.mess_bodiyy')

            messages.push({
                from: spans.eq(3).text().replace(/\(.*?\)/, '').trim(),
                to: spans.eq(1).text(),
                created: $message('.e7m.tooltip').text().replace('Created: ', ''),
                subject: $message('h1').text(),
                message: messageBody.text().trim(),
                links
            })
        }

        return messages
    }
}

// ── Ingat email terakhir yang di-generate tiap user, biar .checkmail bisa dipanggil tanpa argumen ──
const STORE_FILE = path.join(process.cwd(), 'database', 'tempmail', 'sessions.json')

async function loadStore() {
    try {
        return JSON.parse(await fs.readFile(STORE_FILE, 'utf8'))
    } catch {
        return {}
    }
}

async function saveStore(data) {
    await fs.mkdir(path.dirname(STORE_FILE), { recursive: true })
    await fs.writeFile(STORE_FILE, JSON.stringify(data, null, 2), 'utf8')
}

async function handler(m) {
    const generator = new EmailGenerator()
    const text = (m.text || '').trim()
    const isCheck = m.command === 'checkmail' || m.command === 'inbox'

    if (isCheck) {
        let email = text
        if (!email) {
            const store = await loadStore()
            email = store[m.sender]?.email
            if (!email) {
                return m.reply(`❌ Kamu belum pernah generate email. Bikin dulu pakai \`${m.prefix}tempmail\`, atau kasih email-nya langsung: \`${m.prefix}checkmail <email>\`.`)
            }
        }

        m.react('📬')
        try {
            const res = await generator.getInbox(email)
            if (!res.success) {
                m.react('❌')
                return m.reply(`❌ ${res.result}`)
            }

            const { inbox } = res.result
            if (inbox.length === 0) {
                m.react('😴')
                return m.reply(`📭 *${email}*\n\nInbox masih kosong.`)
            }

            m.react('✅')
            const body = inbox.map((msg, i) =>
                `*#${i + 1}* — dari ${msg.from}\n📌 ${msg.subject || '(tanpa subjek)'}\n🕐 ${msg.created}\n\n${msg.message.slice(0, 500)}${msg.message.length > 500 ? '...' : ''}${msg.links.length ? `\n\n🔗 ${msg.links.join('\n🔗 ')}` : ''}`
            ).join('\n\n━━━━━━━━━━━━━━━\n\n')

            return m.reply(`📬 *${email}* — ${inbox.length} pesan\n\n${body}`)
        } catch (e) {
            m.react('❌')
            return m.reply(`❌ Gagal cek inbox: ${e.message}`)
        }
    }

    // ── generate email baru (.tempmail / .mailgen / .gmailfake) ──
    m.react('⏳')
    try {
        const res = await generator.generate(text)
        if (!res.success) {
            m.react('❌')
            return m.reply(`❌ ${res.result}`)
        }

        const store = await loadStore()
        store[m.sender] = { email: res.result.email, createdAt: Date.now() }
        await saveStore(store)

        m.react('✅')
        return m.reply(
`📧 *Email sementara berhasil dibuat!*

✉️ ${res.result.email}
${res.result.emailStatus ? `✅ Status: ${res.result.emailStatus}\n` : ''}${res.result.uptime ? `⏱️ Uptime: ${res.result.uptime}\n` : ''}
Cek inbox pakai \`${m.prefix}checkmail\` (gak perlu ketik ulang email-nya).`
        )
    } catch (e) {
        m.react('❌')
        return m.reply(`❌ Gagal generate email: ${e.message}`)
    }
}

export { pluginConfig as config, handler }
