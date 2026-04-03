const fs = require('fs');
const path = require('path');

let puppeteer;
try { puppeteer = require('puppeteer-core'); } catch(e) { puppeteer = require('puppeteer'); }

// 💡 [핵심] 가상 모니터(Xvfb) 강제 연결 및 소프트웨어 인코딩 강제
const originalLaunch = puppeteer.launch;
puppeteer.launch = async function(options) {
    // 혹시라도 숨어있을 headless 옵션 제거
    const safeArgs = (options.args || []).filter(arg => !arg.includes('--headless'));

    return originalLaunch.call(puppeteer, {
        ...options,
        executablePath: '/usr/bin/google-chrome', // 설치한 진짜 크롬 사용
        headless: false, // 🔥 "new" 절대 금지! false로 해야 Xvfb 가상 모니터를 사용해 0x0 버그가 사라집니다.
        defaultViewport: { width: 1080, height: 1920 },
        args: [
            ...safeArgs,
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu', 
            '--disable-accelerated-video-encode', // 🔥 GPU가 없는 CI 환경에서 비디오 인코더 고장 방지 (소프트웨어 렌더링 강제)
            '--disable-accelerated-video-decode',
            '--window-size=1080,1920',
            '--display=:99' // Xvfb 포트에 명시적 연결
        ]
    });
};

async function runGitHubRender() {
    console.log("🚀 GitHub Actions: 동적 코드 수신 및 렌더링 준비 시작!");

    const encodedTemplateCode = process.env.TEMPLATE_CODE; 
    const templateName = process.env.TEMPLATE_NAME || "PremiumStoryShortsTemplate";

    if (!encodedTemplateCode) {
        console.error("❌ 치명적 오류: 템플릿 코드를 전달받지 못했습니다.");
        process.exit(1);
    }

    const templateCode = Buffer.from(encodedTemplateCode, 'base64').toString('utf8');
    
    // 로컬 환경과 동일하게 video 폴더 사용
    const videoDir = path.join(__dirname, 'video');
    if (!fs.existsSync(videoDir)) fs.mkdirSync(videoDir, { recursive: true });
    
    // 유저의 원본 템플릿을 생성
    const entryPath = path.join(videoDir, `${templateName}.jsx`);
    fs.writeFileSync(entryPath, templateCode, 'utf8');
    
    console.log(`✅ 동적 템플릿 생성 완료: ${entryPath}`);
    console.log(`📝 코드 프리뷰 (앞 50자): ${templateCode.substring(0, 50).replace(/\n/g, '')}...`);

    const { renderTwickVideo } = await import('@twick/render-server');
    const title = process.env.POST_TITLE || "제목 없음";
    const content = process.env.POST_CONTENT || "내용 없음";
    const config = JSON.parse(process.env.POST_CONFIG || "{}");

    const tempVideoName = 'final_shorts.mp4';
    const cleanContent = content.replace(/[ \t]+/g, ' ').trim();
    const FPS = 30;
    const estimatedSeconds = Math.max(cleanContent.length / 15, 5) + 2; 
    const totalFrames = Math.ceil(estimatedSeconds * FPS);

    console.log(`🎬 렌더링 세팅: ${totalFrames}프레임 (${estimatedSeconds}초), 1080x1920`);

    try {
        await renderTwickVideo({
            input: {
                entry: entryPath, 
                properties: {
                    postTitle: title, 
                    postContent: cleanContent, 
                    cardBgColor: config?.cardBgColor || "#1a1a24"
                },
                durationInFrames: totalFrames, 
                fps: FPS, 
                width: 1080, 
                height: 1920
            }
        }, { 
            outFile: tempVideoName, 
            quality: "high" 
        });

        const outputDir = path.join(__dirname, 'output');
        if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
        
        const finalDest = path.join(outputDir, 'final_shorts.mp4');
        if (fs.existsSync(tempVideoName)) {
            fs.renameSync(tempVideoName, finalDest);
            console.log(`✅ 비디오 렌더링 최종 성공! 파일 크기: ${fs.statSync(finalDest).size} bytes`);
        } else {
            throw new Error("렌더링은 완료되었으나 mp4 파일이 디스크에 생성되지 않았습니다.");
        }
        
    } catch (error) { 
        console.error(`❌ 비디오 렌더링 실패:`, error);
        process.exit(1);
    }
}

runGitHubRender();