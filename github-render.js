const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');

// 디버깅을 위해 브라우저 내부 에러를 Node 터미널로 끌어옵니다.
process.env.REMOTION_PUPPETEER_LOG_LEVEL = 'verbose';

// 안전한 Puppeteer 옵션 오버라이드 (Windows 경로 등 불필요한 패치 제거)
const originalLaunch = puppeteer.launch;
puppeteer.launch = async function(options) {
    const safeArgs = (options?.args || []).filter(arg => !arg.includes('--headless'));
    const newOptions = {
        ...options,
        headless: "new", 
        defaultViewport: { width: 1080, height: 1920 },
        args: [ 
            ...safeArgs, 
            '--no-sandbox', 
            '--disable-setuid-sandbox', 
            '--disable-dev-shm-usage',
            '--disable-web-security',
            '--autoplay-policy=no-user-gesture-required' 
        ]
    };
    return originalLaunch.call(puppeteer, newOptions);
};

async function runGitHubRender() {
    console.log("🚀 GitHub Actions: Twick 동적 조립 렌더링 엔진 가동 시작!");

    const { renderTwickVideo } = await import('@twick/render-server');

    const title = process.env.POST_TITLE || "제목 없음";
    const content = process.env.POST_CONTENT || "내용이 없습니다.";
    const templateCode = process.env.TEMPLATE_CODE; 
    const configStr = process.env.POST_CONFIG || "{}";
    let config = {};
    try { config = JSON.parse(configStr); } catch(e) { console.error("Config Parse Error"); }
    
    if (!templateCode) {
        console.error("❌ 치명적 오류: 백엔드로부터 템플릿 코드를 전달받지 못했습니다.");
        process.exit(1);
    }

    const outputDir = path.join(__dirname, 'output');
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

    // 1단계: 프론트엔드에서 넘어온 컴포넌트를 저장합니다.
    const templatePath = path.join(__dirname, 'Template.jsx');
    fs.writeFileSync(templatePath, templateCode, 'utf8');

    const cleanContent = content.replace(/[ \t]+/g, ' ').trim();
    const FPS = 30;
    const estimatedSeconds = Math.max(cleanContent.length / 15, 5) + 2; 
    const totalFrames = Math.ceil(estimatedSeconds * FPS);

    // 💡 2단계: 핵심 해결책 - 번들러가 인식할 수 있는 Root 진입점을 동적으로 생성합니다!
    const propsData = {
        postTitle: title, 
        postContent: cleanContent, 
        views: "15,820", 
        postUp: 940,
        cardBgColor: config?.cardBgColor || "#1a1a24"
    };

    const rootCode = `
import React from 'react';
import { Composition, registerRoot } from '@twick/core'; // 엔진의 코어 API 확인 필요 (Remotion 기준)
import Template from './Template';

export const RemotionRoot = () => {
    return (
        <Composition
            id="DynamicShorts"
            component={Template}
            durationInFrames={${totalFrames}}
            fps={${FPS}}
            width={1080}
            height={1920}
            defaultProps={${JSON.stringify(propsData)}}
        />
    );
};
registerRoot(RemotionRoot);
    `;
    const rootPath = path.join(__dirname, 'Root.jsx');
    fs.writeFileSync(rootPath, rootCode, 'utf8');
    console.log(`✅ 진입점 동적 래핑 완료: Root.jsx 생성됨`);

    const tempVideoName = 'final_shorts.mp4';

    try {
        // 3단계: 엔진에게 템플릿 자체가 아닌, 'Root.jsx'를 진입점으로 넘깁니다.
        // 이때 엔진 내부적으로 esbuild나 Webpack이 구동되어 JSX를 파싱하게 됩니다.
        await renderTwickVideo({
            input: {
                entry: rootPath, 
                properties: propsData, // Props로 데이터 주입
                durationInFrames: totalFrames, 
                fps: FPS, 
                width: 1080, 
                height: 1920
            }
        }, { outFile: tempVideoName, quality: "high" });

        await new Promise(resolve => setTimeout(resolve, 2000));
        const finalDest = path.join(__dirname, 'output', 'final_shorts.mp4');
        const possiblePaths = [path.join(__dirname, tempVideoName), path.join(outputDir, tempVideoName)];

        let foundPath = possiblePaths.find(p => fs.existsSync(p));
        if (foundPath) {
            fs.renameSync(foundPath, finalDest);
            console.log(`📂 최종 파일 구출 완료! 크기: ${fs.statSync(finalDest).size} bytes`);
        } else {
            throw new Error("렌더링 결과 파일을 찾을 수 없습니다.");
        }
    } catch (error) {
        console.error(`❌ 비디오 렌더링 실패 상세 로그:`, error);
        process.exit(1);
    }
}
runGitHubRender();