// Career Ops LinkedIn Sync Bookmarklet
// Drag this to your bookmarks bar, then click it on any LinkedIn conversation page.
// It scrapes visible messages and sends them to your Convex backend.

javascript:void(function(){
  var CONVEX_URL="https://steady-opossum-661.convex.cloud";

  /* Find conversation partner URL */
  function getPartnerUrl(){
    var el=document.querySelector('a[href*="/in/"]');
    if(!el)return null;
    var h=el.getAttribute("href");
    return h.startsWith("http")?h:"https://www.linkedin.com"+h;
  }

  /* Get logged-in user name */
  function getMyName(){
    var el=document.querySelector(".global-nav__me-content .t-14");
    if(el)return el.textContent.trim();
    var img=document.querySelector("img.global-nav__me-photo");
    if(img)return(img.getAttribute("alt")||"").replace(/'s?\s*photo$/i,"").trim();
    return null;
  }

  /* Scrape messages */
  function scrape(){
    var msgs=[];
    var my=getMyName();
    var items=document.querySelectorAll('li[class*="msg-s-event-listitem"], .msg-s-event-listitem');
    items.forEach(function(item){
      var bodyEl=item.querySelector(".msg-s-event-listitem__body")||item.querySelector('p[class*="msg-s-event-listitem"]');
      if(!bodyEl)return;
      var body=bodyEl.textContent.trim();
      if(!body)return;
      var dir="inbound";
      if(item.closest(".msg-s-message-group--outbound")||(!item.closest(".msg-s-event-listitem--other"))){
        dir="outbound";
      }
      var timeEl=item.querySelector("time");
      var sentAt=timeEl?(timeEl.getAttribute("datetime")||timeEl.textContent.trim()):new Date().toISOString();
      msgs.push({body:body,direction:dir,sentAt:sentAt});
    });
    return msgs;
  }

  /* Main */
  var partner=getPartnerUrl();
  if(!partner){alert("Career Ops: Can't find contact profile link on this page.");return;}
  var messages=scrape();
  if(messages.length===0){alert("Career Ops: No messages found on this page.");return;}

  var status=document.createElement("div");
  status.style.cssText="position:fixed;top:20px;right:20px;z-index:99999;padding:12px 20px;background:#2563eb;color:white;border-radius:8px;font:600 14px sans-serif;box-shadow:0 4px 12px rgba(0,0,0,0.3);";
  status.textContent="Syncing "+messages.length+" messages...";
  document.body.appendChild(status);

  fetch(CONVEX_URL+"/api/linkedin-sync",{
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({contactLinkedinUrl:partner,messages:messages})
  }).then(function(r){return r.json()}).then(function(data){
    if(data.success){
      status.textContent="Synced "+data.synced+" messages ("+data.skipped+" skipped) for "+data.contactName;
      status.style.background="#22c55e";
    }else{
      status.textContent="Error: "+(data.error||"Unknown");
      status.style.background="#ef4444";
    }
    setTimeout(function(){status.remove()},5000);
  }).catch(function(e){
    status.textContent="Network error: "+e.message;
    status.style.background="#ef4444";
    setTimeout(function(){status.remove()},5000);
  });
}())
