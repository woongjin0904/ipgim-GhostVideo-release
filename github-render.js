const fs = require('fs');
const path = require('path');

// Puppeteer 로드
let puppeteer;
try { puppeteer = require('puppeteer-core'); } catch(e) { puppeteer = require('puppeteer'); }

const originalLaunch = puppeteer.launch;
puppeteer.launch = async function(options) {
    // 기존 설정과 충돌하지 않도록 필터링
    const baseArgs = (options.args || []).filter(arg => 
        !arg.includes('--headless') && !arg.includes('--disable-gpu')
    );

    const browser = await originalLaunch.call(puppeteer, {
        ...options,
        headless: "new",
        defaultViewport: { width: 1080, height: 1920 },
        args: [
            ...baseArgs,
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--use-gl=angle',             // 🔥 [핵심] Linux CI에서 WebCodecs를 구동하기 위한 필수 플래그
            '--use-angle=swiftshader',    // 🔥 [핵심] 하드웨어 가속 없이 소프트웨어 렌더링 강제
            '--window-size=1080,1920'
        ]
    });

    // 만약의 사태를 대비한 내부 로그 추적 유지
    browser.on('targetcreated', async (target) => {
        if (target.type() === 'page') {
            const page = await target.page();
            if (page) {
                page.on('console', msg => {
                    if (msg.type() === 'error') console.error('🖥️ [Browser Error]:', msg.text());
                });
                page.on('pageerror', error => console.error('🚨 [React Crash]:', error.message));
            }
        }
    });

    return browser;
};

async function runGitHubRender() {
    console.log("🚀 GitHub Actions: 동적 코드 수신 및 조립 시작!");

    const encodedTemplateCode = process.env.TEMPLATE_CODE; 
    // 기본값을 기존 템플릿 이름과 동일하게 맞춤
    const templateName = process.env.TEMPLATE_NAME || "PremiumStoryShortsTemplate";

    if (!encodedTemplateCode) {
        console.error("❌ 치명적 오류: 템플릿 코드를 전달받지 못했습니다.");
        process.exit(1);
    }

    const templateCode = Buffer.from(encodedTemplateCode, 'base64').toString('utf8');
    
    const srcDir = path.join(__dirname, 'src');
    if (!fs.existsSync(srcDir)) fs.mkdirSync(srcDir, { recursive: true });
    
    // 래퍼를 벗기고 사용자의 원본 코드를 그대로 진입점(Entry)으로 사용합니다.
    const entryPath = path.join(srcDir, `${templateName}.jsx`);
    fs.writeFileSync(entryPath, templateCode, 'utf8');
    
    console.log(`✅ 동적 템플릿 생성 완료: ${entryPath}`);

    const { renderTwickVideo } = await import('@twick/render-server');
    const title = process.env.POST_TITLE || "제목 없음";
    const content = process.env.POST_CONTENT || "내용 없음";
    const config = JSON.parse(process.env.POST_CONFIG || "{}");

    const tempVideoName = 'final_shorts.mp4';
    const cleanContent = content.replace(/[ \t]+/g, ' ').trim();
    const FPS = 30;
    const estimatedSeconds = Math.max(cleanContent.length / 15, 5) + 2; 
    const totalFrames = Math.ceil(estimatedSeconds * FPS);

    console.log(`🎬 렌더링 준비: ${totalFrames}프레임 (${estimatedSeconds}초)`);

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
            throw new Error("렌더링은 완료되었으나 mp4 파일이 생성되지 않았습니다.");
        }
        
    } catch (error) { 
        console.error(`❌ 비디오 렌더링 실패:`, error);
        process.exit(1);
    }
}

runGitHubRender();