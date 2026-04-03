// github-render.js
const fs = require('fs');
const path = require('path');

let puppeteer;
try {
    puppeteer = require('puppeteer-core');
} catch(e) {
    puppeteer = require('puppeteer');
}

const originalLaunch = puppeteer.launch;
puppeteer.launch = async function(options) {
    const newOptions = {
        ...options,
        // 🔥 핵심 1: H.264 코덱이 포함된 깃허브 서버의 '정식 상용 구글 크롬'을 강제 지정합니다.
        executablePath: '/usr/bin/google-chrome',
        args: [
            ...(options?.args || []),
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-web-security',
            // 🔥 핵심 2: GPU가 없는 리눅스에서 화면과 픽셀을 완벽하게 렌더링하는 소프트웨어 가속기
            '--use-gl=swiftshader',
            '--window-size=1080,1920',
            '--autoplay-policy=no-user-gesture-required'
        ]
    };
    return originalLaunch.call(puppeteer, newOptions);
};

async function runGitHubRender() {
    console.log("🚀 GitHub Actions: Twick 리눅스 렌더링 엔진 가동 시작!");

    const { renderTwickVideo } = await import('@twick/render-server');

    const title = process.env.POST_TITLE || "제목 없음";
    const content = process.env.POST_CONTENT || "내용이 없습니다.";
    const templateName = process.env.TEMPLATE_NAME || "PremiumStoryShortsTemplate";
    const configRaw = process.env.POST_CONFIG || "{}";
    const config = JSON.parse(configRaw);

    const outputDir = path.join(__dirname, 'output');
    const buggyDir1 = path.join(outputDir, __dirname); 
    const buggyDir2 = path.join(outputDir, __dirname, 'output');
    
    [outputDir, buggyDir1, buggyDir2].forEach(dir => {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
    });

    const tempVideoName = 'final_shorts.mp4';
    const cleanContent = content.replace(/[ \t]+/g, ' ').trim();

    const FPS = 30;
    const estimatedSeconds = Math.max(cleanContent.length / 15, 5) + 2; 
    const totalFrames = Math.ceil(estimatedSeconds * FPS);

    console.log(`[${title}] 렌더링 중... (예상 프레임: ${totalFrames})`);

    try {
        await renderTwickVideo(
            {
                input: {
                    entry: path.join(__dirname, 'video', `${templateName}.jsx`),
                    properties: {
                        postTitle: title,
                        postContent: cleanContent,
                        views: "15,820",
                        postUp: 940,
                        cardBgColor: config?.cardBgColor || "#1a1a24",
                        config: config,
                        width: 1080,
                        height: 1920,
                        durationInFrames: totalFrames,
                        fps: FPS
                    },
                    durationInFrames: totalFrames,
                    fps: FPS,
                    width: 1080,
                    height: 1920
                }
            },
            {
                outFile: tempVideoName,
                quality: "high"
            }
        );

        console.log(`✅ 비디오 렌더링 엔진 통과! FFmpeg 스트림 안정화 대기 중...`);
        
        // 🔥 핵심 3: 비동기 버그 회피. FFmpeg가 MP4 파일을 디스크에 완전히 기록할 수 있도록 3초 대기합니다.
        await new Promise(resolve => setTimeout(resolve, 3000));

        const finalDest = path.join(__dirname, 'output', 'final_shorts.mp4');
        const possiblePaths = [
            path.join(__dirname, tempVideoName),
            path.join(outputDir, tempVideoName),
            path.join(buggyDir1, tempVideoName),
            path.join(buggyDir2, tempVideoName),
        ];

        let foundPath = null;
        for (const p of possiblePaths) {
            if (fs.existsSync(p)) {
                foundPath = p;
                break;
            }
        }

        if (foundPath) {
            if (foundPath !== finalDest) {
                fs.renameSync(foundPath, finalDest);
            }
            console.log(`📂 최종 파일 구출 완료! 크기 확인: ${fs.statSync(finalDest).size} bytes. YAML 업로드 준비 끝: ${finalDest}`);
        } else {
            throw new Error("렌더링은 에러 없이 끝났으나 결과 파일을 찾을 수 없습니다.");
        }

    } catch (error) {
        console.error(`❌ 비디오 렌더링 실패:`, error);
        process.exit(1);
    }
}
 
runGitHubRender();