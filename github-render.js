const fs = require('fs');
const path = require('path');

// Puppeteer 로드
let puppeteer;
try { puppeteer = require('puppeteer-core'); } catch(e) { puppeteer = require('puppeteer'); }

// 💡 [핵심 패치 1] 브라우저 콘솔 하이재킹 (내부 에러를 밖으로 끌어냄)
const originalLaunch = puppeteer.launch;
puppeteer.launch = async function(options) {
    const browser = await originalLaunch.call(puppeteer, {
        ...options,
        headless: "new", // GitHub Actions에서는 new 모드가 가장 안정적입니다.
        defaultViewport: { width: 1080, height: 1920 },
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-web-security',
            '--window-size=1080,1920'
        ]
    });

    // 헤드리스 브라우저 안에서 일어나는 모든 에러를 터미널로 가져옵니다.
    browser.on('targetcreated', async (target) => {
        if (target.type() === 'page') {
            const page = await target.page();
            if (page) {
                page.on('console', msg => {
                    if (msg.type() === 'error') console.error('🖥️ [Browser Error]:', msg.text());
                    else console.log('🖥️ [Browser Log]:', msg.text());
                });
                page.on('pageerror', error => console.error('🚨 [React/DOM Crash]:', error.message));
            }
        }
    });

    return browser;
};

async function runGitHubRender() {
    console.log("🚀 GitHub Actions: 동적 코드 수신 및 조립 시작!");

    const encodedTemplateCode = process.env.TEMPLATE_CODE; 
    const templateName = process.env.TEMPLATE_NAME || "DynamicTemplate";

    if (!encodedTemplateCode) {
        console.error("❌ 치명적 오류: 템플릿 코드를 전달받지 못했습니다.");
        process.exit(1);
    }

    const templateCode = Buffer.from(encodedTemplateCode, 'base64').toString('utf8');
    
    const srcDir = path.join(__dirname, 'src');
    if (!fs.existsSync(srcDir)) fs.mkdirSync(srcDir, { recursive: true });
    
    // 1. 유저가 보낸 원본 템플릿 파일 생성
    const templatePath = path.join(srcDir, `${templateName}.jsx`);
    fs.writeFileSync(templatePath, templateCode, 'utf8');

    // 💡 [핵심 패치 2] 절대 0x0이 되지 않는 강제 래퍼(Wrapper) 생성
    // 프론트엔드 코드가 깨지더라도 부모 요소가 1080x1920을 유지하게 만듭니다.
    const wrapperCode = `
import React from 'react';
import Template from './${templateName}';

export default function ForceSizeWrapper(props) {
    return (
        <div style={{ 
            width: '1080px', 
            height: '1920px', 
            position: 'absolute', 
            top: 0, 
            left: 0, 
            overflow: 'hidden', 
            backgroundColor: '#000' 
        }}>
            <Template {...props} />
        </div>
    );
}
    `;
    const entryPath = path.join(srcDir, 'EntryWrapper.jsx');
    fs.writeFileSync(entryPath, wrapperCode, 'utf8');
    
    console.log(`✅ 동적 템플릿 및 안전 래퍼 생성 완료: ${entryPath}`);

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
                entry: entryPath, // 원본이 아닌 강제 래퍼를 엔트리로 삽입
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
        console.log(`✅ 비디오 렌더링 최종 성공! 파일 크기: ${fs.statSync(finalDest).size} bytes`);
        
    } catch (error) { 
        console.error(`❌ 비디오 렌더링 실패:`, error);
        process.exit(1);
    }
}

runGitHubRender();