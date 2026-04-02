import React, { useState, useEffect } from 'react';

export default function ShortsTemplate({ 
  postTitle = "제목 없음", 
  postContent = "", 
  views = "0", 
  postUp = 0, 
  cardBgColor = "#ffd7d7" 
}) {
  const [index, setIndex] = useState(0);

  // React 기반 타이핑 애니메이션 이펙트
  // Twick은 렌더링 시 브라우저 프레임을 통제하므로 setInterval이 
  // 실제 시간 지연 없이 정확한 프레임으로 캡처됩니다.
  useEffect(() => {
    const timer = setInterval(() => {
      setIndex((prev) => (prev < postContent.length ? prev + 1 : prev));
    }, 50); // 글자당 노출 속도
    
    return () => clearInterval(timer);
  }, [postContent]);

  const displayedText = postContent.slice(0, index);
  const isTypingDone = index >= postContent.length;

  return (
    <div style={{
      width: '1080px', height: '1920px', 
      backgroundColor: '#1a1a1a', 
      display: 'flex', justifyContent: 'center', alignItems: 'center', 
      fontFamily: "'Apple SD Gothic Neo', sans-serif"
    }}>
      <div style={{
        width: '940px', 
        backgroundColor: cardBgColor, 
        borderRadius: '32px', 
        padding: '70px', 
        boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
        display: 'flex', flexDirection: 'column'
      }}>
        {/* 헤더: 제목 및 정보 */}
        <div style={{ borderBottom: '3px solid rgba(0,0,0,0.1)', paddingBottom: '30px', marginBottom: '40px' }}>
          <div style={{
            display: 'inline-block', border: '2px solid #ff3333', color: '#ff3333', 
            borderRadius: '30px', padding: '8px 20px', fontSize: '24px', 
            marginBottom: '20px', fontWeight: 'bold'
          }}>
            + 오늘의 랭킹
          </div>
          <h1 style={{ fontSize: '46px', color: '#000', margin: '0 0 20px 0', lineHeight: '1.4', wordBreak: 'keep-all' }}>
            {postTitle}
          </h1>
          <div style={{ fontSize: '28px', color: '#666', display: 'flex', gap: '20px' }}>
            <span>조회수 {views}</span>
            <span>|</span>
            <span style={{ color: '#ff3333', fontWeight: 'bold' }}>추천 {postUp}</span>
          </div>
        </div>

        {/* 본문: 타이핑 애니메이션 영역 */}
        <div style={{
          fontSize: '38px', color: '#222', lineHeight: '1.7', 
          whiteSpace: 'pre-wrap', minHeight: '600px', wordBreak: 'keep-all'
        }}>
          {displayedText}
          {/* 깜빡이는 커서 (타이핑이 끝나면 사라짐) */}
          {!isTypingDone && (
            <span style={{ 
              display: 'inline-block', width: '5px', height: '40px', 
              backgroundColor: '#ff3333', marginLeft: '8px', verticalAlign: 'middle' 
            }} />
          )}
        </div>
      </div>
    </div>
  );
}