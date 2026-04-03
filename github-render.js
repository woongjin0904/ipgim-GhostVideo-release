const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

// 💡 [궁극의 기법] 메인 프로세스 실행 시, 스스로를 복제하며 모든 워커 스레드에 강제 Hook 주입
if (!process.env.IS_CHILD_PROCESS) {
    const preloadPath = path.join(__dirname, 'global-hook.js');
    
    // 워커 스레드까지 침투할 바이러스(Hook) 코드 작성
    const preloadCode = `
    const Module = require('module');
    const originalRequire = Module.prototype.require;
    
    Module.prototype.require = function(request) {
        const exports = originalRequire.apply(this, arguments);
        // 엔진이 puppeteer를 로드하려고 할 때 가로챔
        if (request === 'puppeteer' || request === 'puppeteer-core') {
            if (!exports.__patched) {
                const originalLaunch = exports.launch;
                exports.launch = async function(options) {
                    const browser = await originalLaunch.call(this, {
                        ...options,
                        headless: false,
                        args: [
                            ...(options.args || []),
                            '--no-sandbox',
                            '--disable-setuid-sandbox',
                            '--disable-dev-shm-usage',
                            '--disable-gpu',
                            '--window-size=1080,1920'
                        ]
                    });
                    
                    // 브라우저 탭이 열릴 때마다 내부 조작 시작
                    browser.on('targetcreated', async (target) => {
                        if (target.type() === 'page') {
                            try {
                                const page = await target.page();
                                if (page) {
                                    // 1. 브라우저 내부의 모든 로그와 에러를 GitHub Actions로 생중계
                                    page.on('console', msg => console.log('🖥️ [브라우저 내부 로그]:', msg.text()));
                                    page.on('pageerror', err => console.log('🚨 [브라우저 치명적 에러]:', err.message));
                                    
                                    // 2. [가장 중요] VideoEncoder C++ 충돌이 일어나기 전, JS 레벨에서 0x0 수치를 강제 조작
                                    await page.evaluateOnNewDocument(() => {
                                        if (window.VideoEncoder) {
                                            const origConfig = window.VideoEncoder.prototype.configure;
                                            window.VideoEncoder.prototype.configure = function(config) {
                                                console.log('⚙️ [인코더 가로채기 성공] 원래 시도된 설정:', JSON.stringify(config));
                                                // 0x0이 들어오면 무조건 1080x1920으로 멱살 잡고 끌어올림
                                                if (!config.width || config.width === 0) config.width = 1080;
                                                if (!config.height || config.height === 0) config.height = 1920;
                                                return origConfig.call(this, config);
                                            };
                                        }
                                    });
                                }
                            } catch(e) {}
                        }
                    });
                    return browser;
                };
                exports.__patched = true;
            }
        }
        return exports;
    };
    `;
    fs.writeFileSync(preloadPath, preloadCode);

    console.log("🚀 [System] 워커 스레드 강제 제어 모드로 렌더링 엔진을 재가동합니다...");
    
    // NODE_OPTIONS를 통해 생성되는 모든 Node.js 프로세스(워커 포함)가 위 코드를 먼저 실행하도록 강제
    const result = spawnSync('node', [__filename], {
        stdio: 'inherit',
        env: {
            ...process.env,
            IS_CHILD_PROCESS: '1',
            NODE_OPTIONS: `${process.env.NODE_OPTIONS || ''} --require ${preloadPath}`
        }
    });
    process.exit(result.status || 0);
}

// ---------------------------------------------------------------------------------
// ▼ 여기서부터는 원래 실행되어야 할 렌더링 메인 로직입니다. (워커의 지배를 받는 상태)
// ---------------------------------------------------------------------------------
async function runGitHubRender() {
    console.log("🎬 렌더링 엔진: 작업 준비 중...");

    const encodedTemplateCode = process.env.TEMPLATE_CODE; 
    const templateName = process.env.TEMPLATE_NAME || "PremiumStoryShortsTemplate";

    if (!encodedTemplateCode) {
        console.error("❌ 템플릿 코드 누락");
        process.exit(1);
    }

    const templateCode = Buffer.from(encodedTemplateCode, 'base64').toString('utf8');
    const srcDir = path.join(__dirname, 'src');
    if (!fs.existsSync(srcDir)) fs.mkdirSync(srcDir, { recursive: true });
    
    const entryPath = path.join(srcDir, `${templateName}.jsx`);
    fs.writeFileSync(entryPath, templateCode, 'utf8');

    const { renderTwickVideo } = await import('@twick/render-server');
    const title = process.env.POST_TITLE || "제목 없음";
    const content = process.env.POST_CONTENT || "내용 없음";
    const config = JSON.parse(process.env.POST_CONFIG || "{}");

    const tempVideoName = 'final_shorts.mp4';
    const cleanContent = content.replace(/[ \t]+/g, ' ').trim();
    const FPS = 30;
    const estimatedSeconds = Math.max(cleanContent.length / 15, 5) + 2; 
    const totalFrames = Math.ceil(estimatedSeconds * FPS);

    console.log(`🎬 렌더링 시작: ${totalFrames}프레임 (${estimatedSeconds}초)`);

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
        fs.renameSync(tempVideoName, finalDest);
        console.log(`✅ 비디오 렌더링 완벽 성공!`);
        
    } catch (error) { 
        console.error(`❌ 비디오 렌더링 실패:`, error);
        process.exit(1);
    }
}

runGitHubRender();