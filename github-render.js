const fs = require('fs');
const path = require('path');

let puppeteer;
try { puppeteer = require('puppeteer-core'); } catch(e) { puppeteer = require('puppeteer'); }

// [적용됨] 💡 방어 전략: 제어문자 및 따옴표 정제 (하단 코드 반영)
const safeReplace = (text) => {
    if (!text) return "";
    return text
        .replace(/[\u0000-\u0008\u000B-\u000C\u000E-\u001F\u007F-\u009F]/g, '')
        .replace(/"/g, "'")
        .trim();
};

// [적용됨] Base64 디코딩 헬퍼 (평문 텍스트와의 호환성을 고려한 안전한 디코딩)
const decodeBase64Safe = (str) => {
    if (!str) return "";
    try {
        // 평문이 섞여있을 수 있으므로 정규식으로 Base64 형식인지 간단히 검사
        const isBase64 = /^([A-Za-z0-9+/]{4})*([A-Za-z0-9+/]{3}=|[A-Za-z0-9+/]{2}==)?$/.test(str.trim());
        if (isBase64) {
            return Buffer.from(str, 'base64').toString('utf8');
        }
    } catch (e) {}
    return str;
};

const originalLaunch = puppeteer.launch;
puppeteer.launch = async function(options) {
    const safeArgs = (options?.args || []).filter(arg => !arg.includes('--headless'));
    
    const browser = await originalLaunch.call(puppeteer, {
        ...options,
        headless: "new", 
        defaultViewport: { width: 1080, height: 1920 },
        args: [
            ...safeArgs, 
            '--no-sandbox', 
            '--disable-setuid-sandbox', 
            '--disable-dev-shm-usage', 
            '--window-size=1080,1920', 
            '--autoplay-policy=no-user-gesture-required',
            // 🔥 1. 크롬 자체 팝업 차단 강제 활성화
            '--disable-popup-blocking=false', 
            '--block-new-web-contents',
            // [적용됨] 💡 리눅스 환경 대응 및 폰트 렌더링 최적화 옵션 추가 (하단 코드 반영)
            '--use-gl=angle', 
            '--font-render-hinting=none'
        ]
    });

    // 🔥 2. 새 탭(팝업 광고) 감지 및 즉시 종료 전역 이벤트
    browser.on('targetcreated', async (target) => {
        if (target.type() === 'page') {
            const newPage = await target.page();
            const opener = await target.opener();
            
            // 부모 창에서 파생된 새 탭(대부분 다운로드 버튼 클릭 시 열리는 악성 팝업) 즉시 닫기
            if (opener && newPage) {
                console.log("🚫 [광고 차단] 예상치 못한 팝업이 감지되어 즉시 닫습니다.");
                try { await newPage.close(); } catch (e) {}
                return;
            }

            // 🔥 3. 메인 페이지의 악성 광고 네트워크 리소스 원천 차단 (선택)
            if (newPage) {
                try {
                    await newPage.setRequestInterception(true);
                    newPage.on('request', (req) => {
                        const url = req.url().toLowerCase();
                        // 팝업, 광고 도메인이 포함된 요청은 차단
                        if (url.includes('googleads') || url.includes('doubleclick') || url.includes('adsystem') || url.includes('popunder')) {
                            req.abort();
                        } else {
                            req.continue();
                        }
                    });

                    // [적용됨] 💡 글로벌 폰트(Pretendard 및 다국어) 강제 주입 (하단 코드 반영)
                    // 생성되는 모든 페이지에 강제로 웹 폰트를 로드하고 적용합니다.
                    await newPage.evaluateOnNewDocument(() => {
                        const fontCSS = `
                            @import url("https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.8/dist/web/static/pretendard.css");
                            * {
                                font-family: 'Pretendard', 'Noto Sans CJK KR', 'Noto Color Emoji', sans-serif !important;
                            }
                        `;
                        document.addEventListener("DOMContentLoaded", () => {
                            const styleSheet = document.createElement("style");
                            styleSheet.type = "text/css";
                            styleSheet.innerText = fontCSS;
                            document.head.appendChild(styleSheet);
                        });
                    });

                } catch (e) {}
            }
        }
    });

    return browser;
};

async function runGitHubRender() {
    console.log("🚀 GitHub Actions: 렌더링 엔진 가동 시작!");

    const { renderTwickVideo } = await import('@twick/render-server');

    // [적용됨] 모든 Env 변수에 대한 Base64 디코딩 시도 및 제어문자 방어
    let title = decodeBase64Safe(process.env.POST_TITLE) || "제목 없음";
    let content = decodeBase64Safe(process.env.POST_CONTENT) || "내용이 없습니다.";
    
    title = safeReplace(title);
    content = safeReplace(content);

    const templateCode = decodeBase64Safe(process.env.TEMPLATE_CODE); 
    let config = {};
    const rawConfig = process.env.POST_CONFIG || "{}";

    try {
        config = JSON.parse(rawConfig);
    } catch (e) {
        try {
            const decodedConfig = decodeBase64Safe(rawConfig) || Buffer.from(rawConfig, 'base64').toString('utf8');
            config = JSON.parse(decodedConfig);
        } catch (decodeErr) {
            console.warn("⚠️ POST_CONFIG 파싱 실패, 빈 객체 또는 기본 UI 설정을 사용합니다.", decodeErr);
            config = {};
        }
    }
    const templateName = process.env.TEMPLATE_NAME || "PremiumStoryShortsTemplate";

    if (!templateCode) {
        console.error("❌ 치명적 오류: 템플릿 코드를 전달받지 못했습니다.");
        process.exit(1);
    }

    const entryPath = path.join(__dirname, `${templateName}.jsx`);
    fs.writeFileSync(entryPath, templateCode, 'utf8');

    // [적용됨] 출력 폴더 보장 위치 조정 (코드 상단 통일)
    const outputDir = path.join(__dirname, 'output');
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }
    const tempVideoName = 'final_shorts.mp4';

    const cleanContent = content.replace(/[ \t]+/g, ' ').trim();
    const FPS = 30;
    
    // 🔥 [핵심] 프론트엔드 에디터와 100% 동일한 방식으로 영상 길이를 계산합니다.
    const charsPerSecond = config?.charsPerSecond || 25;
    const paragraphLimit = config?.paragraphLimit || 4;
    const readingPauseSec = 1.5;

    const lines = cleanContent.split('\n');
    const pages = [];
    let tempLines = [];
    lines.forEach(line => {
      tempLines.push(line);
      if (tempLines.length >= paragraphLimit) { pages.push(tempLines.join('\n')); tempLines = []; }
    });
    if (tempLines.length > 0) pages.push(tempLines.join('\n'));
    if (pages.length === 0) pages.push("");

    let totalSec = 0;
    pages.forEach(text => { totalSec += (text.length / charsPerSecond) + readingPauseSec; });
    
    const estimatedSeconds = Math.max(totalSec, 5);
    // [적용됨] 프레임 하한선 150프레임 방어 로직 추가 (하단 코드 반영)
    const totalFrames = Math.max(Math.ceil(estimatedSeconds * FPS), 150);

    console.log(`🎬 렌더링 세팅: 속도 ${charsPerSecond}자/초 | ${totalFrames}프레임 (${estimatedSeconds}초)`);
    console.log(`[INFO] 렌더링 시작...`);

    try {
        await renderTwickVideo({
            input: {
                entry: entryPath, 
                properties: {
                    postTitle: title, postContent: cleanContent, views: "15,820", postUp: 940,
                    cardBgColor: config?.cardBgColor || "#1a1a24",
                    paragraphLimit: paragraphLimit, charsPerSecond: charsPerSecond, // 🔥 속도값 주입
                    width: 1080, height: 1920, durationInFrames: totalFrames, fps: FPS
                },
                durationInFrames: totalFrames, duration: estimatedSeconds, frameCount: totalFrames, fps: FPS, width: 1080, height: 1920
            }
        }, { outFile: tempVideoName, quality: "high" });

        const expectedPath = path.join(outputDir, tempVideoName);
        const rootPath = path.join(__dirname, tempVideoName);

        let finalPath = '';
        if (fs.existsSync(expectedPath)) {
            finalPath = expectedPath;
        } else if (fs.existsSync(rootPath)) {
            fs.renameSync(rootPath, expectedPath);
            finalPath = expectedPath;
        } else {
            throw new Error("어디에도 렌더링된 파일이 없습니다.");
        }
        
        // [적용됨] 완료 메시지 포맷 정리
        console.log(`📂 렌더링 완료! 결과물 위치: ${finalPath}`);
        console.log(`   └ 파일 크기: ${fs.statSync(finalPath).size} bytes`);

    } catch (error) {
        console.error(`❌ 비디오 렌더링 실패:`, error);
        process.exit(1);
    }
}
runGitHubRender();