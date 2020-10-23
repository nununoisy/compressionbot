const os = require('os');
const fs = require('fs');
const path = require('path');

const Discord = require('discord.js');
const client = new Discord.Client();

const fetch = require('node-fetch');

const VideoCompressor = require('./compressvideo');

client.once('ready', ()=>{
    console.log('Logged in to Discord');
});

const messageHandler = message=>{
    if (message.author.id === client.user.id) return;
    if (!message.mentions.has(client.user)) return;

    let videourl = '', fname = '', tmppath = '';
    
    //console.log(message.attachments);
    //console.log(message.embeds);

    if (message.attachments.size > 0) {
        //message.channel.send('attachment');
        let attachment = message.attachments.first();
        //message.channel.send(`${attachment.id} ${attachment.name} <${attachment.url}>`);
        videourl = attachment.url;
    }
    let embeds = message.embeds.filter(embed=>(embed.video && embed.video.url && !embed.provider));
    if (embeds.length > 0) {
        //message.channel.send('embed');
        let embed = embeds[0];
        //message.channel.send(`${embed.type} ${embed.video.url}`);
        videourl = embed.video.url;
    }

    if (!videourl) return;

    console.log(videourl);

    message.channel.send('<a:loading:769053563980218389> Downloading video...').then(msg=>{
        return fetch(videourl).then(v=>v.buffer()).then(videodata=>{
            tmppath = fs.mkdtempSync(path.join(os.tmpdir(), 'compressionbot-'));
            let fbasename = videourl.replace(/.*\/(.*)$/, '$1');
            fname = path.join(tmppath, fbasename);
            console.log('Downloading video to', fname);
            fs.writeFileSync(fname, videodata);
            return msg;
        });
    }).then(msg=>msg.edit('<a:loading:769053563980218389> Starting compression...')).then(msg=>{
        console.log('Video is downloaded to', fname);
        msg.edit(`<a:loading:769053563980218389> Compressing... 0% complete`);
        let compressor = new VideoCompressor(fname);
        let percentage = 0;
        let intval = setInterval(()=>{
            msg.edit(`<a:loading:769053563980218389> Compressing... ${percentage}% complete`);
        }, 2000);
        compressor.on('progress', (d,t)=>{
            percentage = Math.max(0,Math.min(100,Math.round(100*d/t)));
        });
        compressor.on('status', s=>{
            if (s==='end') {
                clearInterval(intval);
                msg.delete()
                let uattach = new Discord.MessageAttachment(compressor.getOutPath());
                message.channel.send(`<a:done:769055833131843584> ${message.author}:`, uattach).then(()=>{
                    console.log('Done, removing tempdir', tmppath);
                    fs.rmdirSync(tmppath, {recursive: true, force: true});
                });
            }
        });
        compressor.compress();
    });
}

client.on('messageUpdate', (oldMessage, newMessage)=>{
    if (oldMessage.content === newMessage.content) {
        messageHandler(newMessage);
    }
});

client.on('message', messageHandler);

client.login(process.env.BOTTOKEN);