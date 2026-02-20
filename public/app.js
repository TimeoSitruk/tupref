class TuPreferesGame {
  constructor() {
    this.objets = [];
    this.currentPlayers = []; // joueurs actifs pour le round en cours (solo local or room items)
    this.nextRoundPlayers = []; // gagnants qui passeront au round suivant
    this.pairs = []; // liste des paires pour le round actuel (solo only)
    this.pairIndex = 0; // index de la paire courante (solo only)
    this.roundNumber = 1;
    this.loading = true;

    // Multiplayer state
    this.mode = 'solo'; // 'solo' or 'multi'
    this.room = null; // room object from server
    this.playerId = this.getOrCreatePlayerId();
    this.poller = null;
  }

  async loadObjets() {
    try {
      const response = await fetch("/objets.csv");
      if (!response.ok) throw new Error(`Erreur HTTP: ${response.status}`);
      const text = await response.text();
      this.objets = text
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l.length > 0);
      return this.objets.length > 0;
    } catch (e) {
      console.error(e);
      alert('Erreur: impossible de charger objets.csv');
      return false;
    }
  }

  // Mélange Fisher-Yates
  shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // Prépare les paires pour un round à partir de currentPlayers
  preparePairs() {
    const players = this.shuffle(this.currentPlayers);
    const pairs = [];
    for (let i = 0; i < players.length; i += 2) {
      if (i + 1 < players.length) pairs.push([players[i], players[i + 1]]);
      else pairs.push([players[i], null]); // bye
    }
    this.pairs = pairs;
    this.pairIndex = 0;
  }

  // Render current pair
  renderPair() {
    const buttonsContainer = document.querySelector('#buttonsContainer');
    const roundInfo = document.querySelector('#roundInfo');
    roundInfo.textContent = `Round ${this.roundNumber} • Paires restantes: ${Math.max(0, this.pairs.length - this.pairIndex)}`;


    if (this.pairIndex >= this.pairs.length) {
      // round finished
      this.finishRound();
      return;
    }

    const [a, b] = this.pairs[this.pairIndex];
    if (b === null) {
      // bye: automatically advance
      this.nextRoundPlayers.push(a);
      this.pairIndex++;
      this.renderPair();
      return;
    }

    buttonsContainer.innerHTML = `
      <button class="choice-button" id="btnA">${a}</button>
      <div style="text-align:center; font-weight:700; color:#666; margin:6px 0;">ou</div>
      <button class="choice-button" id="btnB">${b}</button>
    `;

    document.getElementById('btnA').onclick = () => this.recordVote(a);
    document.getElementById('btnB').onclick = () => this.recordVote(b);
  }

  // Enregistrer le vote pour le duel courant
  recordVote(winner) {
    // push winner to next round
    this.nextRoundPlayers.push(winner);
    this.pairIndex++;
    // proceed to next pair
    this.renderPair();
  }

  // Quand toutes les paires d'un round ont été traitées
  finishRound() {
    // If only one player remains, show winner
    if (this.nextRoundPlayers.length <= 1) {
      this.showFinalWinner(this.nextRoundPlayers[0] || 'Aucun gagnant');
      return;
    }

    // Prepare next round
    this.currentPlayers = this.nextRoundPlayers.slice();
    this.nextRoundPlayers = [];
    this.roundNumber++;
    this.preparePairs();
    this.renderPair();
  }

  showFinalWinner(winner) {
    const buttonsContainer = document.querySelector('#buttonsContainer');
    buttonsContainer.innerHTML = `\n      <div style="text-align:center">\n        <h2>Félicitation, tu préfères donc ${winner}. T'es bizarre un peu.</h2>\n        <button class="choice-button" onclick="game.restart()">Recommencer</button>\n      </div>\n    `;
  }

  restart() {
    this.currentPlayers = this.objets.slice();
    this.nextRoundPlayers = [];
    this.roundNumber = 1;
    this.preparePairs();
    this.renderPair();
  }

  renderInitialUI() {
    // Hide loading and keep setup controls hidden until mode chosen
    document.querySelector('#loading').style.display = 'none';
    document.querySelector('#setupControls').style.display = 'none';
    document.querySelector('#multiplayerControls').style.display = 'none';
    // hide game area until user starts
    document.querySelector('#gameContainer').style.display = 'none';
    // Show mode selection menu
    document.querySelector('#modeSelect').style.display = 'flex';
    // top section removed from HTML

    // Setup slider UI (slider selects number of pairs)
    const slider = document.getElementById('countSlider');
    const valueSpan = document.getElementById('countValue');
    const availablePairs = Math.floor(this.objets.length / 2);
    const desiredMin = 10;
    const desiredMax = 50;
    // If not enough pairs available, allow smaller range starting at 1
    if (availablePairs >= desiredMin) {
      slider.min = desiredMin;
    } else {
      slider.min = 1;
    }
    slider.max = Math.max(1, Math.min(desiredMax, availablePairs));
    // default value: desiredMin if possible, otherwise max available
    slider.value = Math.min(desiredMin, slider.max);
    valueSpan.textContent = slider.value;
    slider.oninput = () => { valueSpan.textContent = slider.value; };

    const startSoloBtn = document.getElementById('startSoloBtn');
    const finalizeCreateBtn = document.getElementById('finalizeCreateBtn');
    if (startSoloBtn) startSoloBtn.onclick = () => this.startSoloWithCount();
    if (finalizeCreateBtn) finalizeCreateBtn.onclick = () => this.finalizeCreateRoom();

    // Mode selection handlers
    document.getElementById('soloModeBtn').onclick = () => this.selectSoloMode();
    document.getElementById('multiModeBtn').onclick = () => this.selectMultiMode();

    document.getElementById('createRoomBtn').onclick = () => this.createRoom();
    document.getElementById('joinRoomBtn').onclick = () => {
      const id = document.getElementById('joinRoomInput').value.trim();
      if (id) this.joinRoom(id);
    };

    // populate name input from session
    const nameInput = document.getElementById('playerNameInput');
    try { nameInput.value = sessionStorage.getItem('tp_name') || ''; } catch(e){}
    nameInput.oninput = () => { try{ sessionStorage.setItem('tp_name', nameInput.value.trim()); }catch(e){} };
  }

  async init() {
    const ok = await this.loadObjets();
    if (!ok) return;
    this.currentPlayers = this.objets.slice();
    // Prepare UI and wait for user to start with selected count
    this.renderInitialUI();
  }

  // Start tournament with N items chosen from the CSV
  startWithCount() {
    const slider = document.getElementById('countSlider');
    let pairs = parseInt(slider.value, 10) || 10;
    pairs = Math.max(1, Math.min(pairs, Math.floor(this.objets.length / 2)));
    const count = pairs * 2; // number of objects to sample
    // sample 'count' unique items
    const sampled = this.shuffle(this.objets).slice(0, count);
    this.currentPlayers = sampled;
    this.nextRoundPlayers = [];
    this.roundNumber = 1;
    this.preparePairs();
    // hide setup and show game
    document.querySelector('#setupControls').style.display = 'none';
    document.querySelector('#gameContainer').style.display = 'block';
    // top section removed from HTML
    this.renderPair();
  }

  startSoloWithCount() {
    // reuse startWithCount flow but ensure mode and UI are set for solo
    this.mode = 'solo';
    this.startWithCount();
  }

  /* ---------- Multiplayer helpers ---------- */
  getOrCreatePlayerId() {
    try {
      // use sessionStorage so each tab/window gets a unique id
      let id = sessionStorage.getItem('tp_playerId');
      if (!id) {
        id = this.genId(8);
        sessionStorage.setItem('tp_playerId', id);
      }
      return id;
    } catch (e) {
      return this.genId(8);
    }
  }

  genId(len = 6) {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let s = '';
    for (let i = 0; i < len; i++) s += chars[Math.floor(Math.random() * chars.length)];
    return s;
  }

  selectSoloMode() {
    this.mode = 'solo';
    document.getElementById('modeSelect').style.display = 'none';
    document.getElementById('multiplayerControls').style.display = 'none';
    document.getElementById('setupControls').style.display = 'block';
    // ensure correct buttons visible
    const startSoloBtn = document.getElementById('startSoloBtn');
    const finalizeCreateBtn = document.getElementById('finalizeCreateBtn');
    if (startSoloBtn) startSoloBtn.style.display = 'inline-block';
    if (finalizeCreateBtn) finalizeCreateBtn.style.display = 'none';
  }

  selectMultiMode() {
    this.mode = 'multi';
    document.getElementById('modeSelect').style.display = 'none';
    // show create/join directly; slider will appear after clicking Create salon
    document.getElementById('multiplayerControls').style.display = 'block';
    document.getElementById('setupControls').style.display = 'none';
  }

  createRoom() {
    // Two-phase creation: reveal slider + finalize button
    this.creatingRoom = true;
    // hide create/join controls while selecting count
    document.getElementById('multiplayerControls').style.display = 'none';
    document.getElementById('setupControls').style.display = 'block';
    const startSoloBtn = document.getElementById('startSoloBtn');
    const finalizeCreateBtn = document.getElementById('finalizeCreateBtn');
    if (startSoloBtn) startSoloBtn.style.display = 'none';
    if (finalizeCreateBtn) finalizeCreateBtn.style.display = 'inline-block';
  }

  async finalizeCreateRoom() {
    // actually create after user picked slider
    const sampled = (() => {
      const slider = document.getElementById('countSlider');
      let pairs = parseInt(slider.value, 10) || 10;
      pairs = Math.max(1, Math.min(pairs, Math.floor(this.objets.length / 2)));
      const count = pairs * 2;
      return this.shuffle(this.objets).slice(0, count);
    })();
    const name = (document.getElementById('playerNameInput') || {}).value || '';
    try{ sessionStorage.setItem('tp_name', name.trim()); }catch(e){}
    let desiredId = prompt('Entrez l\'ID du salon (lettres/chiffres) :');
    if (!desiredId) {
      alert('ID du salon requis');
      return;
    }
    desiredId = desiredId.trim();
    const body = { action: 'create_room', items: sampled, playerId: this.playerId, playerName: name, roomId: desiredId };
    try {
      const res = await fetch('/api/vote', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const j = await res.json();
      if (j.ok && j.roomId) {
        this.room = j.room;
        this.room.id = j.roomId;
        const info = document.getElementById('roomInfo');
        info.innerHTML = `Salon: <strong style="margin-right:6px">${j.roomId}</strong>`;
        const copyBtn = document.createElement('button');
        copyBtn.textContent = 'Copier ID';
        copyBtn.className = 'choice-button';
        copyBtn.style.padding = '6px 10px';
        copyBtn.style.minHeight = '36px';
        copyBtn.onclick = () => { navigator.clipboard && navigator.clipboard.writeText(j.roomId); };
        info.appendChild(copyBtn);
        this.startPolling();
        document.querySelector('#setupControls').style.display = 'none';
        document.querySelector('#gameContainer').style.display = 'block';
        this.creatingRoom = false;
      } else {
        alert('Erreur création salon');
      }
    } catch (e) {
      console.error(e);
      alert('Erreur création salon');
    }
  }

  async joinRoom(roomId) {
    const name = (document.getElementById('playerNameInput') || {}).value || '';
    try{ sessionStorage.setItem('tp_name', name.trim()); }catch(e){}
    const body = { action: 'join_room', roomId, playerId: this.playerId, playerName: name };
    try {
      const res = await fetch('/api/vote', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const j = await res.json();
      if (j.ok) {
        this.room = j.room;
        this.room.id = roomId;
        const info = document.getElementById('roomInfo');
        info.innerHTML = `Salon: <strong style="margin-right:6px">${roomId}</strong>`;
        const copyBtn = document.createElement('button');
        copyBtn.textContent = 'Copier ID';
        copyBtn.className = 'choice-button';
        copyBtn.style.padding = '6px 10px';
        copyBtn.style.minHeight = '36px';
        copyBtn.onclick = () => { navigator.clipboard && navigator.clipboard.writeText(roomId); };
        info.appendChild(copyBtn);
        document.querySelector('#multiplayerControls').style.display = 'none';
        document.querySelector('#gameContainer').style.display = 'block';
        this.startPolling();
      } else {
        alert('Impossible de rejoindre le salon');
      }
    } catch (e) {
      console.error(e);
      alert('Erreur rejoindre salon');
    }
  }

  startPolling() {
    if (this.poller) clearInterval(this.poller);
    this.poller = setInterval(() => this.fetchRoomState(), 900);
    // fetch immediately
    this.fetchRoomState();
  }

  stopPolling() {
    if (this.poller) clearInterval(this.poller);
    this.poller = null;
  }

  async fetchRoomState() {
    if (!this.room || !this.room.id) return;
    try {
      const res = await fetch('/api/vote', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'get_state', roomId: this.room.id }) });
      const j = await res.json();
      if (j.ok) {
        this.room = j.room;
        this.renderMultiPair();
      }
    } catch (e) {
      console.error('fetchRoomState', e);
    }
  }

  async sendVoteToRoom(selected) {
    if (!this.room || !this.room.id) return;
    try {
      const body = { action: 'vote', roomId: this.room.id, playerId: this.playerId, choice: selected };
      const res = await fetch('/api/vote', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const j = await res.json();
      if (!j.ok) alert('Erreur envoi vote');
      // show waiting UI until poll updates
      this.renderWaitingState();
    } catch (e) {
      console.error(e);
    }
  }

  renderWaitingState() {
    const votesPanel = document.getElementById('votesPanel');
    const spinnerHtml = `<div style="text-align:center;"><div class="spinner"></div><div style="margin-top:8px; font-weight:700; color:#444;">En attente des autres joueurs...</div></div>`;
    if (votesPanel) {
      votesPanel.innerHTML = spinnerHtml;
      // also disable buttons if present
      const btnA = document.getElementById('btnA');
      const btnB = document.getElementById('btnB');
      if (btnA) btnA.disabled = true;
      if (btnB) btnB.disabled = true;
    } else {
      const buttonsContainer = document.querySelector('#buttonsContainer');
      buttonsContainer.innerHTML = spinnerHtml;
    }
  }

  renderMultiPair() {
    const buttonsContainer = document.querySelector('#buttonsContainer');
    const roundInfo = document.querySelector('#roundInfo');
    if (!this.room) return;
    roundInfo.textContent = `Salon ${this.room.id} • Round ${this.room.roundNumber || 1}`;

    const idx = this.room.pairIndex || 0;
    const pair = (this.room.pairs && this.room.pairs[idx]) || null;
    if (!pair) {
      buttonsContainer.innerHTML = `<div style="text-align:center; font-weight:700; color:#666;">En attente de joueurs ou partie terminée</div>`;
      return;
    }

    const a = pair[0];
    const b = pair[1];
    // show choices + players count
    buttonsContainer.innerHTML = `
      <button class="choice-button" id="btnA">${a}</button>
      <div style="text-align:center; font-weight:700; color:#666; margin:6px 0;">ou</div>
      <button class="choice-button" id="btnB">${b}</button>
      <div style="margin-top:8px; text-align:center; color:#666; font-size:0.9em;">Joueurs connectés: ${this.room.players ? this.room.players.length : 0}</div>
      <div id="votesPanel" style="margin-top:10px;"></div>
    `;

    // check whether current player already voted
    const votesForPair = (this.room.votes && this.room.votes[idx]) || {};
    const voted = !!votesForPair[this.playerId];
    // If room.ready (all voted) show votes breakdown and next button for creator
    const ready = !!this.room.ready;
    const votesPanel = document.getElementById('votesPanel');

    if (voted && !ready) {
      // show waiting spinner but keep votesPanel in DOM so we can render results when ready
      document.getElementById('btnA').disabled = true;
      document.getElementById('btnB').disabled = true;
      this.renderWaitingState();
    } else {
      document.getElementById('btnA').onclick = () => this.sendVoteToRoom(a);
      document.getElementById('btnB').onclick = () => this.sendVoteToRoom(b);
    }

    if (ready) {
      // reveal votes
      const players = this.room.players || [];
      const vp = document.createElement('div');
      vp.style.textAlign = 'center';
      vp.style.marginTop = '8px';
      vp.innerHTML = '<strong>Résultats :</strong>';
      const list = document.createElement('div');
      list.style.marginTop = '8px';
      for (const p of players) {
        // support player as string or object
        const pid = (typeof p === 'string') ? p : (p && p.id);
        const name = (typeof p === 'string') ? p : (p && (p.name || p.id));
        const choice = (this.room.votes && this.room.votes[idx] && this.room.votes[idx][pid]) || '—';
        const row = document.createElement('div');
        row.style.margin = '4px 0';
        row.textContent = `${name}: ${choice}`;
        list.appendChild(row);
      }
      if (votesPanel) {
        votesPanel.innerHTML = '';
        votesPanel.appendChild(vp);
        votesPanel.appendChild(list);
      }

      // if current player is creator, show Next button
      if (this.room.creatorId === this.playerId) {
        const nextBtn = document.createElement('button');
        nextBtn.className = 'choice-button';
        nextBtn.textContent = 'Suivant';
        nextBtn.style.padding = '8px 14px';
        nextBtn.style.marginTop = '10px';
        nextBtn.onclick = () => this.sendNext();
        if (votesPanel) votesPanel.appendChild(nextBtn);
      }
    }
  }

  async sendNext() {
    if (!this.room || !this.room.id) return;
    try {
      const body = { action: 'next', roomId: this.room.id, playerId: this.playerId };
      const res = await fetch('/api/vote', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const j = await res.json();
      if (!j.ok) alert('Erreur next');
      // refresh state after next
      this.fetchRoomState();
    } catch (e) {
      console.error(e);
    }
  }
}

const game = new TuPreferesGame();
game.init();
