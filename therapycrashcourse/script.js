const STORAGE_KEY = "tcc_progress_v1";
const DEFAULT_STATE = { m1:false, m2:false, m3:false, m4:false };

function loadState(){
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : { ...DEFAULT_STATE };
  } catch {
    return { ...DEFAULT_STATE };
  }
}
function saveState(state){ localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }

function render(state){
  Object.keys(state).forEach(id=>{
    const chip = document.getElementById("chip-"+id);
    const text = document.getElementById("chipText-"+id);
    if(state[id]) {
      chip.dataset.state = "done";
      text.textContent = "Completed";
    } else {
      chip.dataset.state = "todo";
      text.textContent = "Not started";
    }
  });
  const done = Object.values(state).filter(Boolean).length;
  const total = Object.keys(state).length;
  const pct = Math.round((done/total)*100);
  document.getElementById("barFill").style.width = pct+"%";
  document.getElementById("pctLabel").textContent = `${pct}% • ${done}/${total}`;
}

let state = loadState();
render(state);

document.querySelectorAll(".markBtn").forEach(btn=>{
  btn.addEventListener("click", e=>{
    const id = e.currentTarget.dataset.target;
    state[id] = !state[id];
    saveState(state);
    render(state);
  });
});

document.getElementById("resetBtn").addEventListener("click", ()=>{
  if(confirm("Reset your saved progress?")){
    state = { ...DEFAULT_STATE };
    saveState(state);
    render(state);
  }
});
