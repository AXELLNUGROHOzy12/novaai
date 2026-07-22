/*
Diadaptasi dari script Freegen text-to-image (sign -> submit -> tunggu hasil via websocket)
jadi plugin Nova. Logic inti gak diubah, cuma dibungkus config/handler + kirim hasilnya ke WA.
*/
import crypto from 'crypto'
import { WebSocket } from 'ws'

const pluginConfig = {
    name: 'freegen',
    alias: ['fg', 'fgimg', 'imagine2'],
    category: 'ai',
    description: 'Text-to-image pakai Freegen (gratis, tanpa API key)',
    usage: '.freegen [rasio] <prompt>',
    example: '.freegen 16:9 kucing astronot di bulan',
    isEnabled: true
}

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'
const SIGNER_URL = 'https://prompt-signer.freegen.app'
const GENERATOR_URL = 'https://image-generator.freegen.app'
const WS_URL = 'wss://websocket-bridge.freegen.app/ws'
const RATIOS = ['1:1', '16:9', '9:16', '4:3', '3:4']
const JOB_TIMEOUT_MS = 300000

function makeAuth(jobId) {
    const ts = Math.floor(Date.now() / 1000)
    const msg = jobId + ts
    const hash = crypto.createHash('sha256').update(msg).digest('hex')
    const b64 = Buffer.from(hash, 'utf8').toString('base64').substring(0, 20)
    return b64 + ':' + ts
}

async function sign(prompt) {
    const r = await fetch(SIGNER_URL, {
        method: 'POST',
        headers: {
            'content-type': 'application/json',
            'user-agent': UA,
            origin: 'https://freegen.app',
            referer: 'https://freegen.app/'
        },
        body: JSON.stringify({ prompt })
    })
    if (!r.ok) throw new Error('signer ' + r.status)
    return await r.json()
}

async function submit(prompt, ratio) {
    const { ts, sig } = await sign(prompt)
    const r = await fetch(GENERATOR_URL, {
        method: 'POST',
        headers: {
            'content-type': 'application/json',
            'user-agent': UA,
            origin: 'https://freegen.app',
            referer: 'https://freegen.app/'
        },
        body: JSON.stringify({ prompt, ts, sig, ratio_id: ratio })
    })
    if (!r.ok) throw new Error('generator ' + r.status)
    return await r.json()
}

function waitResult(jobId) {
    return new Promise((resolve, reject) => {
        const auth = makeAuth(jobId)
        const ws = new WebSocket(WS_URL, {
            headers: { origin: 'https://freegen.app', 'user-agent': UA }
        })
        const timer = setTimeout(() => {
            try { ws.close() } catch {}
            reject(new Error('timeout'))
        }, JOB_TIMEOUT_MS)

        ws.on('open', () => {
            ws.send(JSON.stringify({ type: 'subscribe', job_id: jobId, auth }))
        })
        ws.on('message', (raw) => {
            const m = JSON.parse(raw.toString())
            if (m.type === 'status') return
            if (m.type === 'result') {
                clearTimeout(timer)
                try { ws.close() } catch {}
                resolve({ ok: true, image: m.image_data })
            } else if (m.type === 'error') {
                clearTimeout(timer)
                try { ws.close() } catch {}
                resolve({ ok: false, error: m.message || 'unknown' })
            }
        })
        ws.on('error', (e) => {
            clearTimeout(timer)
            reject(e)
        })
    })
}

async function textToImage(prompt, ratio = '1:1') {
    const job = await submit(prompt, ratio)
    if (!job.job_id) return { ok: false, error: 'no job id', raw: job }
    const res = await waitResult(job.job_id)
    if (!res.ok) return { ok: false, error: res.error, job_id: job.job_id }
    return { ok: true, job_id: job.job_id, prompt: job.res_prompt, ratio, image: res.image }
}

async function handler(m, { sock }) {
    const raw = (m.text || '').trim()

    if (!raw) {
        return m.reply(
`🎨 *FREEGEN TEXT-TO-IMAGE*

📌 *Format:* \`${m.prefix}${m.command} [rasio] <prompt>\`
📌 *Rasio tersedia:* ${RATIOS.join(', ')} (default 1:1)
📌 *Contoh:* \`${m.prefix}${m.command} 16:9 kucing astronot di bulan\`

⏳ Proses bisa makan waktu sampai beberapa menit, sabar ya.`
        )
    }

    let ratio = '1:1'
    let prompt = raw
    const firstWord = raw.split(' ')[0]
    if (RATIOS.includes(firstWord)) {
        ratio = firstWord
        prompt = raw.slice(firstWord.length).trim()
    }

    if (!prompt) {
        return m.reply('❌ Prompt-nya kosong. Contoh: `' + m.prefix + m.command + ' 16:9 kucing astronot`')
    }

    m.react('⏳')

    try {
        const result = await textToImage(prompt, ratio)

        if (!result.ok) {
            m.react('❌')
            return m.reply(`❌ Gagal generate: ${result.error}`)
        }

        let imageContent
        if (typeof result.image === 'string' && result.image.startsWith('data:')) {
            const base64 = result.image.split(',')[1] || ''
            imageContent = Buffer.from(base64, 'base64')
        } else if (typeof result.image === 'string' && /^https?:\/\//.test(result.image)) {
            imageContent = { url: result.image }
        } else if (typeof result.image === 'string') {
            imageContent = Buffer.from(result.image, 'base64')
        } else {
            m.react('❌')
            return m.reply('❌ Format hasil gambar gak dikenali.')
        }

        await sock.sendMessage(m.chat, {
            image: imageContent,
            caption: `✅ *${result.prompt || prompt}*\n📐 Rasio: ${result.ratio}`
        }, { quoted: m })

        m.react('✅')
    } catch (e) {
        m.react('❌')
        return m.reply(`❌ Terjadi kesalahan: ${e.message}`)
    }
}

export { pluginConfig as config, handler }
