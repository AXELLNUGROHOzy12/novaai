/*
Diadaptasi dari script reverse-engineering DeepAI (generateIslandKey/generateImage/generateChat)
biar jalan sebagai plugin Nova. Bagian CLI & REST server dibuang karena gak relevan di WA bot.
*/
import axios from 'axios'
import FormData from 'form-data'

const pluginConfig = {
    name: 'deepimg',
    alias: ['deepai', 'txt2imgdeep', 'deepchat', 'deepaichat'],
    category: 'ai',
    description: 'Text-to-image & chat pakai DeepAI (bypass token, gratis tanpa API key)',
    usage: '.deepimg <prompt> | .deepimg fast: <prompt> | .deepchat [model=<id>] <pesan>',
    example: '.deepimg kucing astronot | .deepchat model=gpt-5-nano halo apa kabar',
    isEnabled: true
}

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

// ── 1. Generator token DeepAI (hasil reverse engineering, jangan diutak-atik) ──
function generateIslandKey(userAgent) {
    let myrandomstr = Math.round((Math.random() * 100000000000)) + ""

    const myhashfunction = (function () {
        const a = []
        for (let b = 0; 64 > b;)
            a[b] = 0 | 4294967296 * Math.sin(++b % Math.PI)
        return function (input) {
            let d, e, f, g = [d = 1732584193, e = 4023233417, ~d, ~e],
                h = [],
                l = unescape(encodeURI(input)) + "\u0080",
                k = l.length
            let c = --k / 4 + 2 | 15
            for (h[--c] = 8 * k; ~k;)
                h[k >> 2] |= l.charCodeAt(k) << 8 * k--
            for (let b = 0, l = 0; b < c; b += 16) {
                for (k = g; 64 > l; k = [f = k[3], d + ((f = k[0] + [d & e | ~d & f, f & d | ~f & e, d ^ e ^ f, e ^ (d | ~f)][k = l >> 4] + a[l] + ~~h[b | [l, 5 * l + 1, 3 * l + 5, 7 * l][k] & 15]) << (k = [7, 12, 17, 22, 5, 9, 14, 20, 4, 11, 16, 23, 6, 10, 15, 21][4 * k + l++ % 4]) | f >>> -k), d, e])
                    d = k[1] | 0, e = k[2]
                for (l = 4; l;)
                    g[--l] += k[l]
            }
            let result = ""
            for (let l = 0; 32 > l;)
                result += (g[l >> 3] >> 4 * (1 ^ l++) & 15).toString(16)
            return result.split("").reverse().join("")
        }
    })()

    return 'tryit-' + myrandomstr + '-' + myhashfunction(userAgent + myhashfunction(userAgent + myhashfunction(userAgent + myrandomstr + 'hackers_become_a_little_stinkier_every_time_they_hack')))
}

// ── 2. Text-to-image ──
async function generateImage(promptText, isQualityMode, style, negativePrompt) {
    const apiKey = generateIslandKey(USER_AGENT)

    const form = new FormData()
    form.append('text', promptText)
    if (negativePrompt && negativePrompt.trim() !== '') {
        form.append('negative_prompt', negativePrompt)
    }
    form.append('width', '640')
    form.append('height', '640')
    form.append('image_generator_version', style || 'hd')
    form.append('use_new_model', 'false')
    form.append('use_old_model', 'false')
    form.append('quality', isQualityMode ? 'true' : 'false')
    form.append('generation_source', 'img')

    const headers = {
        ...form.getHeaders(),
        'accept': '*/*',
        'accept-language': 'en-US,en;q=0.9,id;q=0.8',
        'api-key': apiKey,
        'User-Agent': USER_AGENT,
        'Origin': 'https://deepai.org',
        'Referer': 'https://deepai.org/machine-learning-model/text2img',
    }

    const response = await axios.post('https://api.deepai.org/api/text2img', form, { headers })
    return {
        status: 'success',
        prompt: promptText,
        style: style || 'hd',
        quality_mode: isQualityMode,
        negative_prompt: negativePrompt || null,
        download_url: response.data.output_url,
    }
}

// ── 3. Upload lampiran gambar buat chat vision (dari Buffer, bukan path lokal — sesuai alur download gambar WA) ──
async function uploadAttachmentBuffer(buffer, filename = 'image.jpg') {
    const form = new FormData()
    form.append('file', buffer, filename)

    const headers = {
        ...form.getHeaders(),
        'User-Agent': USER_AGENT,
        'Origin': 'https://deepai.org',
        'Referer': 'https://deepai.org/chat',
    }

    const response = await axios.post('https://api.deepai.org/chat_attachments/upload', form, { headers })
    if (response.data?.success && response.data?.attachment) {
        return response.data.attachment.uuid
    }
    throw new Error('Gagal mengunggah gambar.')
}

// ── 4. Chat ──
const VISION_MODELS = ['gemini-2.5-flash-lite', 'gemma-4', 'gpt-5-nano', 'llama-4-scout']

function uuid() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = Math.random() * 16 | 0
        const v = c === 'x' ? r : (r & 0x3 | 0x8)
        return v.toString(16)
    })
}

async function generateChat(messages, model = 'standard', attachmentUuids = []) {
    const apiKey = generateIslandKey(USER_AGENT)

    const form = new FormData()
    form.append('chat_style', 'chat')
    form.append('chatHistory', JSON.stringify(messages))
    form.append('model', model)
    form.append('session_uuid', uuid())
    form.append('sensitivity_request_id', uuid())
    form.append('hacker_is_stinky', 'very_stinky')
    form.append('enabled_tools', JSON.stringify(['image_generator', 'image_editor']))

    let allAttachmentUuids = []
    messages.forEach(msg => {
        if (Array.isArray(msg.attachment_uuids)) allAttachmentUuids.push(...msg.attachment_uuids)
    })
    if (attachmentUuids?.length) allAttachmentUuids.push(...attachmentUuids)
    if (allAttachmentUuids.length) {
        form.append('attachment_uuids', JSON.stringify([...new Set(allAttachmentUuids)]))
    }

    const headers = {
        ...form.getHeaders(),
        'api-key': apiKey,
        'User-Agent': USER_AGENT,
        'Origin': 'https://deepai.org',
        'Referer': 'https://deepai.org/chat',
    }

    const response = await axios.post('https://api.deepai.org/hacking_is_a_serious_crime', form, { headers })
    return { status: 'success', response: response.data }
}

// ── Handler plugin Nova ──
async function handler(m, { sock }) {
    const isChat = m.command === 'deepchat' || m.command === 'deepaichat'
    const rawText = (m.text || '').trim()

    if (isChat) {
        if (!rawText) {
            return m.reply(
`💬 *DEEPAI CHAT*

📌 *Format:* \`${m.prefix}deepchat [model=<id>] <pesan>\`
📌 *Contoh:* \`${m.prefix}deepchat halo, apa kabar?\`
📌 *Contoh pakai model lain:* \`${m.prefix}deepchat model=gpt-5-nano jelasin foto ini\` (reply gambar)

Model vision (bisa baca gambar yang di-reply): ${VISION_MODELS.join(', ')}`
            )
        }

        let model = 'standard'
        let promptText = rawText
        const modelMatch = rawText.match(/^model=(\S+)\s+([\s\S]+)$/i)
        if (modelMatch) {
            model = modelMatch[1]
            promptText = modelMatch[2]
        }

        m.react('⏳')

        try {
            let attachmentUuids = []
            const qMime = m.quoted?.mimetype || ''
            if (/^image\//.test(qMime)) {
                if (!VISION_MODELS.includes(model)) {
                    m.react('❌')
                    return m.reply(`❌ Model \`${model}\` gak support gambar. Pakai salah satu: ${VISION_MODELS.join(', ')}`)
                }
                const buffer = await m.quoted.download()
                const uuidAttach = await uploadAttachmentBuffer(buffer)
                attachmentUuids.push(uuidAttach)
            }

            const newMessage = { role: 'user', content: promptText }
            if (attachmentUuids.length) newMessage.attachment_uuids = attachmentUuids

            const result = await generateChat([newMessage], model, attachmentUuids)
            m.react('✅')
            return m.reply(`${result.response}\n\n_(model: ${model})_`)
        } catch (e) {
            m.react('❌')
            return m.reply(`❌ *Chat Error:* ${e.response?.data ? JSON.stringify(e.response.data) : e.message}`)
        }
    }

    // ── Mode image (deepimg / deepai / txt2imgdeep) ──
    if (!rawText) {
        return m.reply(
`🎨 *DEEPAI TEXT-TO-IMAGE*

📌 *Format:* \`${m.prefix}${m.command} <prompt>\`
📌 *Mode cepat:* \`${m.prefix}${m.command} fast: <prompt>\`
📌 *Contoh:* \`${m.prefix}${m.command} kucing astronot di luar angkasa\``
        )
    }

    let isQualityMode = true
    let promptText = rawText
    if (/^fast:\s*/i.test(rawText)) {
        isQualityMode = false
        promptText = rawText.replace(/^fast:\s*/i, '')
    }

    const [promptPart, negativePart] = promptText.split('|').map(s => s?.trim())

    m.react('⏳')

    try {
        const result = await generateImage(promptPart, isQualityMode, 'hd', negativePart)
        m.react('✅')
        await sock.sendMessage(m.chat, {
            image: { url: result.download_url },
            caption: `✅ *${result.prompt}*\n${isQualityMode ? '🖼️ High-Definition' : '⚡ Speed mode'}${negativePart ? `\n🚫 Negative: ${negativePart}` : ''}`
        }, { quoted: m })
    } catch (e) {
        m.react('❌')
        return m.reply(`❌ *Generate Error:* ${e.response?.data ? JSON.stringify(e.response.data) : e.message}`)
    }
}

export { pluginConfig as config, handler }
