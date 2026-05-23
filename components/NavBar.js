'use client'

function NavBar({ active }) {
  return (
    <div style={{position:'fixed',bottom:0,left:0,right:0,background:'#F7F3EE',borderTop:'1px solid #DDD6CC',display:'flex',justifyContent:'space-around',padding:'10px 0 20px'}}>
      <button onClick={() => window.location.href='/'} style={{display:'flex',flexDirection:'column',alignItems:'center',gap:'3px',background:'none',border:'none',cursor:'pointer',padding:'4px 12px'}}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active==='home'?'#3D2B4F':'#9A928A'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
        <span style={{fontSize:'10px',color:active==='home'?'#3D2B4F':'#9A928A'}}>Home</span>
      </button>
      <button onClick={() => window.location.href='/explore'} style={{display:'flex',flexDirection:'column',alignItems:'center',gap:'3px',background:'none',border:'none',cursor:'pointer',padding:'4px 12px'}}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active==='explore'?'#3D2B4F':'#9A928A'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <span style={{fontSize:'10px',color:active==='explore'?'#3D2B4F':'#9A928A'}}>Explore</span>
      </button>
      <button onClick={() => window.location.href='/saved'} style={{display:'flex',flexDirection:'column',alignItems:'center',gap:'3px',background:'none',border:'none',cursor:'pointer',padding:'4px 12px'}}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill={active==='saved'?'#3D2B4F':'none'} stroke={active==='saved'?'#3D2B4F':'#9A928A'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>
        <span style={{fontSize:'10px',color:active==='saved'?'#3D2B4F':'#9A928A'}}>Saved</span>
      </button>
      <button onClick={() => window.location.href='/profile'} style={{display:'flex',flexDirection:'column',alignItems:'center',gap:'3px',background:'none',border:'none',cursor:'pointer',padding:'4px 12px'}}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active==='profile'?'#3D2B4F':'#9A928A'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
        <span style={{fontSize:'10px',color:active==='profile'?'#3D2B4F':'#9A928A'}}>Profile</span>
      </button>
    </div>
  )
}

export default NavBar
