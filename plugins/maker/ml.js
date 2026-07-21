/*
✦ Nama Plugin: fake ml
✦ Tipe: Plugin Esm
✦ Author: Rynn
✦ channel:  https://whatsapp.com/channel/0029Vb7gcbuLdQelWzrTzD3D
✦ manfaat: gada si 🖤
✦ Note: jangan hapus wm dong aku masih pemula
✦ (diadaptasi biar kompatibel sama loader plugin Nova)
*/
import axios from 'axios'

const pluginConfig = {
    name: 'fakeml',
    alias: ['mlbbfake', 'mlcard', 'mlfake'],
    category: 'maker',
    description: 'Bikin kartu profile ala Mobile Legends dari foto profil/foto yang di-reply',
    usage: '.fakeml <nama> (reply gambar, atau kosongin buat pakai foto profil kamu)',
    example: '.fakeml Misaki',
    isEnabled: true
}

async function handler(m, { sock }) {
    const text = (m.text || '').trim()

    if (!text) {
        return m.reply(
`🎮 *FAKE ML PROFILE*

> Masukkan nama untuk profile

*Contoh:* \`${m.prefix}${m.command} Misaki\``
        )
    }

    const mime = m.quoted?.mimetype || ''

    let buffer
    try {
        if (/image\/(jpe?g|png)/.test(mime)) {
            buffer = await m.quoted.download()
        } else {
            const pp = await sock.profilePictureUrl(m.sender, 'image').catch(() => null)
            if (!pp) {
                return m.reply('❌ Gak nemu foto profil kamu, dan gak ada gambar yang di-reply.\n\nReply sebuah foto pakai `.fakeml <nama>`, atau pasang dulu foto profil WA kamu.')
            }
            const { data } = await axios.get(pp, { responseType: 'arraybuffer' })
            buffer = Buffer.from(data)
        }
    } catch (e) {
        return m.reply('❌ Gagal memproses gambar!')
    }

    m.react('🕕')

    try {
        const form = new FormData()
        const blob = new Blob([buffer], { type: 'image/jpeg' })
        form.append('file', blob, 'image.jpg')

        const res = await axios.post('https://telegra.ph/upload', form)
        const imageUrl = 'https://telegra.ph' + res.data[0].src

        const apiUrl = `https://api.nexray.web.id/maker/fakelobyml?avatar=${encodeURIComponent(imageUrl)}&nickname=${encodeURIComponent(text)}`

        await sock.sendMessage(m.chat, {
            image: { url: apiUrl },
            caption: `✅ *Berhasil membuat kartu ML untuk ${text}*`
        }, { quoted: m })

        m.react('✅')
    } catch (error) {
        m.react('❌')
        m.reply(`❌ Terjadi kesalahan: ${error.message}`)
    }
}

export { pluginConfig as config, handler }
