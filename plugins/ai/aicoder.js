/*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✦ *Nama Plugin:* AiCoder
✦ *Tipe:* Plugin Esm
✦ *Author:* kyzz masih pemula
✦ *Saluran:* https://whatsapp.com/channel/0029Vb7gcbuLdQelWzrTzD3D
★ scrape by : defan
★ source scrape : https://whatsapp.com/channel/0029VbCWturICVfd01iF0y47
✦ *Note:* Sesuaikan dengan sc bot mu aja
✦ (diadaptasi biar kompatibel sama loader plugin Nova)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
*/
import { writeFile, mkdir, readFile } from 'fs/promises'
import { exec } from 'child_process'
import { promisify } from 'util'
import path from 'path'

const execAsync = promisify(exec)

const pluginConfig = {
    name: 'aicoder',
    alias: ['aicode', 'gencode'],
    category: 'tools',
    description: 'Generate kode (landing page, komponen, dll) dari prompt, hasilnya dikirim sebagai file ZIP',
    usage: '.aicoder <deskripsi yang mau dibuat>',
    example: '.aicoder buat landing page portfolio modern',
    isEnabled: true
}

const MODELS = ['zai-org/GLM-5', 'meta-llama/Llama-4-Maverick-17B-128E-Instruct-FP8']
const BASE_URL = 'https://llamacoder.together.ai/api'
const TIMEOUT_MS = 90_000

function fetchWithTimeout(url, opts = {}) {
    const controller = new AbortController()
    const tid = setTimeout(() => controller.abort(), TIMEOUT_MS)
    return fetch(url, { ...opts, signal: controller.signal }).finally(() => clearTimeout(tid))
}

async function handler(m, { sock }) {
    const text = (m.text || '').trim()

    if (!text) {
        return m.reply(
`*📝 CONTOH PENGGUNAAN AICODER*

${m.prefix}${m.command} buat landing page portfolio modern
${m.prefix}${m.command} buat website toko online sederhana
${m.prefix}${m.command} buat aplikasi todo list dengan html css js
${m.prefix}${m.command} buat komponen button dengan tailwind

*💡 TIPS:*
- Gunakan bahasa Indonesia atau Inggris
- Spesifikkan framework (React, Vue, Tailwind dll)
- Sebutkan warna atau tema yang diinginkan
- Jelaskan fungsi yang dibutuhkan

*⚠️ NOTE:*
Hasil berupa file ZIP berisi kode lengkap
Proses butuh waktu 30–60 detik`
        )
    }

    await m.reply('⏳ Generating kode...')
    m.react('⏳')

    let tempDir = null
    let zipPath = null

    try {
        let chatId = null
        let lastMessageId = null
        let usedModel = null

        for (const model of MODELS) {
            try {
                const res = await fetchWithTimeout(`${BASE_URL}/create-chat`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ prompt: text, model, quality: 'low' })
                })

                if (!res.ok) continue
                const data = await res.json()

                if (data?.chatId) {
                    chatId = data.chatId
                    lastMessageId = data.lastMessageId
                    usedModel = model
                    break
                }
            } catch {
                continue
            }
        }

        if (!chatId) {
            m.react('❌')
            return m.reply('❌ Gagal membuat session. Coba lagi nanti.')
        }

        let streamRes
        try {
            streamRes = await fetchWithTimeout(`${BASE_URL}/get-next-completion-stream-promise`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ messageId: lastMessageId, model: usedModel })
            })
        } catch (e) {
            m.react('❌')
            return m.reply(`❌ Gagal stream output: ${e.message}`)
        }

        if (!streamRes.ok) {
            m.react('❌')
            return m.reply(`❌ Stream error: ${streamRes.status}`)
        }

        let fullOutput = ''
        let buffer = ''

        try {
            const reader = streamRes.body.getReader()
            const decoder = new TextDecoder()

            while (true) {
                const { done, value } = await reader.read()
                if (done) break

                buffer += decoder.decode(value, { stream: true })
                const lines = buffer.split('\n')
                buffer = lines.pop()

                for (const line of lines) {
                    const trimmed = line.trim()
                    if (!trimmed) continue
                    try {
                        const j = JSON.parse(trimmed)
                        const content = j?.choices?.[0]?.delta?.content
                        if (content) fullOutput += content
                    } catch {}
                }
            }

            if (buffer.trim()) {
                try {
                    const j = JSON.parse(buffer.trim())
                    const content = j?.choices?.[0]?.delta?.content
                    if (content) fullOutput += content
                } catch {}
            }
        } catch (e) {
            m.react('❌')
            return m.reply(`❌ Error baca stream: ${e.message}`)
        }

        if (!fullOutput) {
            m.react('❌')
            return m.reply('❌ Model tidak menghasilkan output apapun.')
        }

        const files = []
        const regex = /```(?:tsx?|jsx?|css|scss|json|html?|md|env|toml|yaml|yml)\{path=([^}]+)\}\n([\s\S]*?)```/g
        let match
        while ((match = regex.exec(fullOutput)) !== null) {
            const filePath = match[1].replace(/^\//, '')
            const content = match[2]
            if (filePath && content) files.push({ path: filePath, content })
        }

        if (files.length === 0) {
            m.react('❌')
            return m.reply('❌ Tidak ada file yang dihasilkan. Coba prompt yang lebih spesifik.')
        }

        const slug = text.replace(/\s+/g, '-').toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 30)
        tempDir = path.join(process.cwd(), `tmp_aicoder_${Date.now()}`)
        const zipName = `aicoder-${slug}.zip`
        zipPath = path.join(process.cwd(), zipName)

        await mkdir(tempDir, { recursive: true })

        for (const file of files) {
            const filePath = path.join(tempDir, file.path)
            const fileDir = path.dirname(filePath)
            await mkdir(fileDir, { recursive: true })
            await writeFile(filePath, file.content, 'utf8')
        }

        await execAsync(`cd "${tempDir}" && zip -r "${zipPath}" .`)

        const zipBuffer = await readFile(zipPath)

        const caption = `✅ *Selesai!*
📁 ${files.length} file dibuat
🤖 Model: ${usedModel?.split('/').pop() ?? 'unknown'}
📝 Prompt: ${text.slice(0, 60)}${text.length > 60 ? '...' : ''}

*Files:*
${files.map(f => `• \`${f.path}\``).join('\n')}`

        await sock.sendMessage(m.chat, {
            document: zipBuffer,
            mimetype: 'application/zip',
            fileName: zipName,
            caption
        }, { quoted: m })

        m.react('✅')
    } catch (e) {
        m.react('❌')
        await m.reply(`❌ Terjadi kesalahan: ${e.message}`)
    } finally {
        if (tempDir || zipPath) {
            execAsync(`rm -rf "${tempDir}" "${zipPath}"`).catch(() => {})
        }
    }
}

export { pluginConfig as config, handler }
