const fs = require('fs');
const path = require('path');

let puppeteer;
try { puppeteer = require('puppeteer-core'); } catch(e) { puppeteer = require('puppeteer'); }

const originalLaunch = puppeteer.launch;
puppeteer.launch = async function(options) {
    return originalLaunch.call(puppeteer, {
        ...options,
        dumpio: true, // 🔥 [핵심 1] 브라우저 내부의 모든 침묵된 에러를 터미널로 강제 송출
        args: [
            ...(options.args || []),
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--window-size=1080,1920'
        ]
    });
};

async function runGitHubRender() {
    console.log("🚀 GitHub Actions: 최후의 렌더링 엔진 가동 시작!");

    const encodedTemplateCode = process.env.TEMPLATE_CODE; 
    const templateName = process.env.TEMPLATE_NAME || "PremiumStoryShortsTemplate";

    if (!encodedTemplateCode) {
        console.error("❌ 치명적 오류: 템플릿 코드를 전달받지 못했습니다.");
        process.exit(1);
    }

    const templateCode = Buffer.from(encodedTemplateCode, 'base64').toString('utf8');
    
    // 번들러가 인식하던 원래 경로인 video 폴더 사용
    const videoDir = path.join(__dirname, 'video');
    if (!fs.existsSync(videoDir)) fs.mkdirSync(videoDir, { recursive: true });
    
    const templatePath = path.join(videoDir, `${templateName}.jsx`);
    fs.writeFileSync(templatePath, templateCode, 'utf8');

    // 🔥 [핵심 2] 무조건 1080x1920 크기를 보장하며 에러를 화면에 띄우는 벙커 래퍼 생성
    const wrapperCode = `
import React from 'react';
import Template from './${templateName}';

class ErrorBoundary extends React.Component {
    constructor(props) { super(props); this.state = { hasError: false, error: null }; }
    static getDerivedStateFromError(error) { return { hasError: true, error }; }
    render() {
        if (this.state.hasError) {
            return (
                <div style={{ width: '1080px', height: '1920px', backgroundColor: '#500', color: '#fff', padding: '60px', boxSizing: 'border-box' }}>
                    <h1 style={{ fontSize: '60px', marginBottom: '20px' }}>🚨 React Render Error</h1>
                    <p style={{ fontSize: '40px', wordBreak: 'break-all' }}>{String(this.state.error)}</p>
                </div>
            );
        }
        return <Template {...this.props} />;
    }
}

export default function RenderBunker(props) {
    return (
        <div style={{ width: '1080px', height: '1920px', position: 'absolute', top: 0, left: 0, backgroundColor: '#000', overflow: 'hidden' }}>
            <ErrorBoundary>
                <Template {...props} />
            </ErrorBoundary>
        </div>
    );
}
    `;
    const entryPath = path.join(videoDir, 'RenderBunker.jsx');
    fs.writeFileSync(entryPath, wrapperCode, 'utf8');
    
    console.log(`✅ 동적 템플릿 및 방어벽(Bunker) 생성 완료`);

    const { renderTwickVideo } = await import('@twick/render-server');
    const title = process.env.POST_TITLE || "제목 없음";
    const content = process.env.POST_CONTENT || "내용 없음";
    const config = JSON.parse(process.env.POST_CONFIG || "{}");

    const cleanContent = content.replace(/[ \t]+/g, ' ').trim();
    const FPS = 30;
    const estimatedSeconds = Math.max(cleanContent.length / 15, 5) + 2; 
    const totalFrames = Math.ceil(estimatedSeconds * FPS);

    console.log(`🎬 렌더링 세팅: ${totalFrames}프레임 (${estimatedSeconds}초), 1080x1920`);

    try {
        await renderTwickVideo({
            input: {
                entry: entryPath, // 원본 대신 벙커 래퍼를 주입
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
            outFile: 'final_shorts.mp4', 
            quality: "high" 
        });

        const outputDir = path.join(__dirname, 'output');
        if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
        const finalDest = path.join(outputDir, 'final_shorts.mp4');
        
        if (fs.existsSync('final_shorts.mp4')) {
            fs.renameSync('final_shorts.mp4', finalDest);
            console.log(`✅ 비디오 렌더링 완벽 성공!`);
        } else {
            throw new Error("렌더링은 완료되었으나 mp4 파일이 디스크에 생성되지 않았습니다.");
        }
        
    } catch (error) { 
        console.error(`❌ 비디오 렌더링 실패:`, error);
        process.exit(1);
    }
}

runGitHubRender();