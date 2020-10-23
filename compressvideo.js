//const ffmpeg = require('ffmpeg');
const { spawn } = require('child_process');
const EventEmitter = require('events');
const { stat } = require('fs');

class VideoCompressor extends EventEmitter {
    constructor(videoPath) {
        super();
        this.videoPath = videoPath;
        console.log('Initialized compressor for ', this.videoPath);
        this.videoOutPath = videoPath.replace(/(.*)\.(?:.*?)$/, '$1.compressed.mp4');
        console.log('Output:', this.videoOutPath);
    }

    getOutPath() {
        return this.videoOutPath;
    }

    compress() {
        console.log('Starting compression for ', this.videoPath);
    
        let probecmd = `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 '${this.videoPath}'`;
        console.log('Probing with command:');
        console.log(probecmd);
    
        let ffprobe = spawn('ffprobe', [
            '-v', 'error',
            '-show_entries', 'format=duration',
            '-of', 'default=noprint_wrappers=1:nokey=1',
            this.videoPath
        ]);
    
        let probeEncounteredError = false;
        let probeDat = '';
    
        ffprobe.stdout.on('data', data=>{
            console.log(`stdout: ${data}`);
            probeDat+=data;
        });
    
        ffprobe.stderr.on('data', data=>{
            console.log(`stderr: ${data}`);
            probeEncounteredError = true;
        });
    
        ffprobe.on('close', code=>{
            console.log(`ffmpeg exited with code ${code}`);
            if (code !== 0) probeEncounteredError = true;
    
            if (probeEncounteredError) {
                throw new Error('ffprobe failed');
            }
    
            let secRaw = parseFloat(probeDat);
            console.log('Duration (seconds):', secRaw);
            let durationus = secRaw * 1000000;
            console.log('Duration (useconds):', durationus);
    
            let cmd = `ffmpeg -i '${this.videoPath}' -c:v libx264 -c:a libfaac -b:v 10k -b:a 10k -progress pipe:3 -y '${this.videoOutPath}'`;
    
            console.log('Using command:');
            console.log(cmd);
        
            let ffmpeg = spawn('ffmpeg', [
                '-i', this.videoPath,
                '-c:v', 'libx264',
                '-c:a', 'aac',
                '-b:v', '10k',
                '-b:a', '10k',
                '-progress', 'pipe:3',
                '-y',
                this.videoOutPath
            ], {stdio:['pipe','pipe','pipe','pipe']});
        
            ffmpeg.stdio[3].on('data', data=>{
                //console.log(`stdio3: ${data}`);
                data.toString().split('\n').forEach(line=>{
                    if (line.indexOf('out_time_us') > -1) {
                        let progressus = parseInt(line.replace('out_time_us=',''),10);
                        this.emit('progress', progressus, durationus);
                    } else if (line.indexOf('progress') > -1) {
                        this.emit('status', line.replace('progress=',''))
                    }
                })
            });
        
            ffmpeg.stdout.on('data', data=>{
                //console.log(`stdout: ${data}`);
            });
        
            ffmpeg.stderr.on('data', data=>{
                //console.log(`stderr: ${data}`);
            });
        
            ffmpeg.on('close', code=>{
                console.log(`ffmpeg exited with code ${code}`);
            });
        });
    }
}


/*
let compressor = new VideoCompressor(process.argv.pop());

compressor.on('progress', (progressus, durationus) => {
    console.log(`Progress (useconds): ${progressus}/${durationus} ${Math.round(100*progressus/durationus)}%`);
});

compressor.on('status', status => {
    console.log(`Status: ${status}`);
});

compressor.compress();
*/

module.exports = VideoCompressor;