// Career Ops LinkedIn Sync Bookmarklet (v2 — clipboard-based, no CSP issues)
//
// 1. Open a LinkedIn conversation
// 2. Click this bookmarklet
// 3. It copies messages as JSON to your clipboard
// 4. Go to your Outreach Tracker → click "Import LinkedIn Messages" → paste
//
// Paste this as a bookmark URL (include the "javascript:" prefix):

javascript:void(function(){function scrape(){var msgs=[];var items=document.querySelectorAll('li[class*="msg-s-event-listitem"], .msg-s-event-listitem');items.forEach(function(item){var bodyEl=item.querySelector(".msg-s-event-listitem__body")||item.querySelector('p[class*="msg-s-event-listitem"]');if(!bodyEl)return;var body=bodyEl.textContent.trim();if(!body)return;var dir="inbound";if(item.closest(".msg-s-message-group--outbound")||(!item.closest(".msg-s-event-listitem--other"))){dir="outbound";}var timeEl=item.querySelector("time");var sentAt=timeEl?(timeEl.getAttribute("datetime")||timeEl.textContent.trim()):new Date().toISOString();msgs.push({body:body,direction:dir,sentAt:sentAt});});return msgs;}var partnerEl=document.querySelector('a[href*="/in/"]');var partnerUrl=partnerEl?(partnerEl.href||("https://www.linkedin.com"+partnerEl.getAttribute("href"))):"";var messages=scrape();if(messages.length===0){alert("Career Ops: No messages found.");return;}var data=JSON.stringify({contactLinkedinUrl:partnerUrl,messages:messages});navigator.clipboard.writeText(data).then(function(){var n=document.createElement("div");n.style.cssText="position:fixed;top:20px;right:20px;z-index:99999;padding:12px 20px;background:#22c55e;color:white;border-radius:8px;font:600 14px sans-serif;box-shadow:0 4px 12px rgba(0,0,0,0.3);";n.textContent="Copied "+messages.length+" messages! Now paste in Outreach Tracker.";document.body.appendChild(n);setTimeout(function(){n.remove();},4000);}).catch(function(){prompt("Career Ops: Copy this manually:",data);});}())
