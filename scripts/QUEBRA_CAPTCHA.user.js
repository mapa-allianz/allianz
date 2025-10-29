// ==UserScript==
// @name         QUEBRA CAPTCHA 1.1
// @namespace    http://tampermonkey.net/
// @version      1.1
// @description  Monitora assentos e redireciona automaticamente quando disponíveis
// @author       Você
// @match        https://ingressospalmeiras.com.br/Stadium/Index?*
// @grant        none
// @run-at       document-idle
// @updateURL    https://mapa-allianz.github.io/allianz/scripts/QUEBRA_CAPTCHA.user.js
// @downloadURL  https://mapa-allianz.github.io/allianz/scripts/QUEBRA_CAPTCHA.user.js
// ==/UserScript==
//oi eu sou o goku 2
async function clicarIniciarEAguardeAudio() {
    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
async function waitForElement(selector, timeout = 5000) {
    const start = Date.now();
    return new Promise((resolve, reject) => {
        const interval = setInterval(() => {
            const el = document.querySelector(selector);
            if (el) {
                clearInterval(interval);
                resolve(el);
            } else if (Date.now() - start > timeout) {
                clearInterval(interval);
                reject(new Error(`Elemento "${selector}" não apareceu em ${timeout}ms`));
            }
        }, 100); // checa a cada 100ms
    });
}
    const btnIniciar = await waitForElement('#amzn-captcha-verify-button');
    if (btnIniciar) {
        btnIniciar.click();
        console.log('Cliquei em Iniciar');
    } else {
        console.log('Botão "Iniciar" não encontrado');
        return;
    }

    await sleep(500);

    const btnAudio = await waitForElement('#amzn-btn-audio-internal');
    if (btnAudio) {
        btnAudio.click();
        console.log('Cliquei no botão de áudio');
    } else {
        console.log('Botão de áudio não encontrado');
        return;
    }

    await sleep(1500);

    console.log('Processo concluído');
}

(async () => {
  // ====== CONFIGURAÇÃO ======
    const meuTokenAPI = await fetch('https://mapa-allianz.github.io/allianz/audio.txt?v=' + Date.now());
    let HF_TOKEN = await meuTokenAPI.text(); // pega o conteúdo em texto audio.txt

    HF_TOKEN = "hf_" + HF_TOKEN; // adiciona o prefixo "hf_"

	// Em algum ponto do seu código
	await clicarIniciarEAguardeAudio();


  // ====== ENCONTRA O ÁUDIO ======
  const audio = document.querySelector("audio");
  if (!audio) {
    console.error("❌ Nenhum elemento <audio> encontrado na página.");
    return;
  }

  console.log("🎧 Baixando áudio de:", audio.src);
  const responseAudio = await fetch(audio.src);
  const audioBuffer = await responseAudio.arrayBuffer();

  // ====== CONVERTE AAC → WAV ======
  console.log("🎛️ Convertendo áudio para WAV...");
  const audioCtx = new AudioContext();
  const decoded = await audioCtx.decodeAudioData(audioBuffer);

  function audioBufferToWav(buffer) {
    const numOfChan = buffer.numberOfChannels;
    const length = buffer.length * numOfChan * 2 + 44;
    const bufferArray = new ArrayBuffer(length);
    const view = new DataView(bufferArray);

    const writeString = (offset, str) => {
      for (let i = 0; i < str.length; i++) {
        view.setUint8(offset + i, str.charCodeAt(i));
      }
    };

    let offset = 0;
    writeString(offset, "RIFF"); offset += 4;
    view.setUint32(offset, 36 + buffer.length * numOfChan * 2, true); offset += 4;
    writeString(offset, "WAVE"); offset += 4;
    writeString(offset, "fmt "); offset += 4;
    view.setUint32(offset, 16, true); offset += 4;
    view.setUint16(offset, 1, true); offset += 2;
    view.setUint16(offset, numOfChan, true); offset += 2;
    view.setUint32(offset, buffer.sampleRate, true); offset += 4;
    view.setUint32(offset, buffer.sampleRate * numOfChan * 2, true); offset += 4;
    view.setUint16(offset, numOfChan * 2, true); offset += 2;
    view.setUint16(offset, 16, true); offset += 2;
    writeString(offset, "data"); offset += 4;
    view.setUint32(offset, buffer.length * numOfChan * 2, true); offset += 4;

    let chan = new Float32Array(buffer.length * numOfChan);
    for (let c = 0; c < numOfChan; c++) {
      const channel = buffer.getChannelData(c);
      for (let i = 0; i < buffer.length; i++) {
        chan[i * numOfChan + c] = channel[i];
      }
    }

    let pos = offset;
    for (let i = 0; i < chan.length; i++, pos += 2) {
      const s = Math.max(-1, Math.min(1, chan[i]));
      view.setInt16(pos, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    }

    return new Blob([view], { type: "audio/wav" });
  }

  const wavBlob = audioBufferToWav(decoded);
  console.log("✅ Conversão concluída. Enviando...");

  // ====== ENVIA PARA HUGGING FACE ======
  const response = await fetch("https://router.huggingface.co/hf-inference/models/openai/whisper-large-v3", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${HF_TOKEN}`,
      "Content-Type": "audio/wav",
    },
    body: wavBlob,
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`❌ Erro ao enviar para a API: ${response.status} ${response.statusText}`);
    console.error(errorText);
    return;
  }

  const result = await response.json();
  console.log("📝 Transcrição completa:", result.text);

  // ====== PEGA UMA DAS DUAS ÚLTIMAS PALAVRAS ======
  const palavras = result.text.trim().split(/\s+/);
  const palavraEscolhida = (palavras[palavras.length - 2] || palavras[palavras.length - 1]).replace(/[.,!?;:]$/, '');
  console.log("🟢 Palavra detectada:", palavraEscolhida);

  // ====== PREENCHER INPUT E CLICAR ======
  const inputField = document.querySelector('input[placeholder="Resposta"]');
  const submitBtn = document.querySelector('#amzn-btn-verify-internal');

  if (!inputField || !submitBtn) {
    console.error("❌ Não encontrou o input ou botão na página.");
    return;
  }

  inputField.value = palavraEscolhida; // Preenche o input
  console.log("✍️ Preenchido o input com a palavra.");

	// Aguarda 0.5s antes de clicar
	setTimeout(() => {
		submitBtn.click();
		console.log("✅ Botão clicado!");

        // Cria o observer para monitorar mudanças no DOM
        const observer = new MutationObserver((mutations) => {
            const alerta = document.querySelector('div[role="alert"] p');
            if (alerta &&
                (alerta.innerText.includes("Incorreto. Por favor, tente novamente.") ||
                 alerta.innerText.includes("Limite de tempo excedido. Atualize a página."))
               ) {
                console.warn("⚠️ Erro detectado, redirecionando...");
                window.location.href = 'https://ingressospalmeiras.com.br/';
                observer.disconnect(); // Para de observar depois de detectar
            }
        });

        // Observa mudanças no body e em todos os filhos
        observer.observe(document.body, { childList: true, subtree: true });


	}, 500);
})();
