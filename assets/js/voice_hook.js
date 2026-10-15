import {Socket} from "phoenix"

// Softphone for Maestro's voice_sandbox channel. Two peer connections, matching
// the sandbox in maestro-platform: the browser offers the microphone uplink,
// and answers the speaker downlink.
export default {
  mounted() {
    this.button = this.el.querySelector("button")
    this.button.addEventListener("click", () => this.toggle())
    this.setState("idle", "Call")
  },

  destroyed() {
    this.hangup()
  },

  toggle() {
    if (this.live) {
      this.hangup()
    } else {
      this.start()
    }
  },

  async start() {
    if (this.starting) return
    this.starting = true
    this.setState("connecting", "Connecting")

    let session
    try {
      const response = await fetch("/api/voice/session", {headers: {accept: "application/json"}})
      if (!response.ok) throw new Error("Maestro voice is unavailable")
      session = await response.json()
    } catch (err) {
      this.fail(err.message)
      return
    }

    const socket = new Socket(session.socket_url, {params: {token: session.token}})
    socket.connect()
    this.socket = socket

    const channel = socket.channel(`voice_sandbox:${crypto.randomUUID()}`, {
      agent_uuid: session.agent_uuid
    })
    this.channel = channel

    channel.on("call_started", () => this.openMedia())
    channel.on("webrtc_signaling", (msg) => this.onSignal(msg))
    channel.on("connection_state", ({state}) => {
      if (state === "connected") this.setState("live", "Hang up")
      if (state === "failed") this.fail("Connection failed")
    })
    channel.on("call_error", ({reason}) => this.fail(reason || "Call failed"))
    channel.on("call_ended", () => this.hangup())

    channel
      .join()
      .receive("ok", () => channel.push("start_call", {}))
      .receive("error", ({reason}) => this.fail(reason || "Could not join the call"))
  },

  async openMedia() {
    this.closePeers()

    let stream
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {echoCancellation: true, noiseSuppression: true, channelCount: 1},
        video: false
      })
    } catch (err) {
      this.fail(err.name === "NotAllowedError" ? "Microphone blocked" : "No microphone")
      return
    }

    this.stream = stream
    const up = new RTCPeerConnection()
    const down = new RTCPeerConnection()
    this.up = up
    this.down = down

    up.onicecandidate = (event) => this.sendIce("up", event.candidate)
    down.onicecandidate = (event) => this.sendIce("down", event.candidate)
    up.onconnectionstatechange = () => {
      if (up.connectionState === "connected") this.setState("live", "Hang up")
      if (up.connectionState === "failed") this.fail("Connection failed")
    }
    down.ontrack = (event) => this.play(event)

    for (const track of stream.getTracks()) up.addTrack(track, stream)

    const offer = await up.createOffer()
    await up.setLocalDescription(offer)
    this.sendSignal("up", "sdp_offer", {type: offer.type, sdp: offer.sdp})
    this.live = true
    this.setState("live", "Hang up")
  },

  async onSignal({dir, type, data}) {
    const pc = dir === "down" ? this.down : this.up
    if (!pc) return

    try {
      if (type === "sdp_answer") {
        await pc.setRemoteDescription(data)
        await this.flushIce(pc)
      } else if (type === "sdp_offer") {
        await pc.setRemoteDescription(data)
        const answer = await pc.createAnswer()
        await pc.setLocalDescription(answer)
        this.sendSignal("down", "sdp_answer", {type: answer.type, sdp: answer.sdp})
        await this.flushIce(pc)
      } else if (type === "ice_candidate") {
        if (pc.remoteDescription) {
          await pc.addIceCandidate(data)
        } else {
          pc.__pending = pc.__pending || []
          pc.__pending.push(data)
        }
      }
    } catch (err) {
      console.error("voice signaling", type, err)
    }
  },

  async flushIce(pc) {
    const pending = pc.__pending || []
    pc.__pending = []
    for (const candidate of pending) {
      try {
        await pc.addIceCandidate(candidate)
      } catch (_err) {}
    }
  },

  sendIce(dir, candidate) {
    if (!candidate) return
    const data = typeof candidate.toJSON === "function" ? candidate.toJSON() : candidate
    this.sendSignal(dir, "ice_candidate", data)
  },

  sendSignal(dir, type, data) {
    if (this.channel) this.channel.push("webrtc_signaling", {dir, type, data})
  },

  play(event) {
    let audio = document.getElementById("remote-audio")
    if (!audio) {
      audio = document.createElement("audio")
      audio.id = "remote-audio"
      audio.autoplay = true
      document.body.appendChild(audio)
    }
    audio.srcObject = event.streams[0] || new MediaStream([event.track])
    audio.play().catch(() => {})
  },

  hangup() {
    if (this.channel) {
      try { this.channel.push("hangup", {}) } catch (_err) {}
      try { this.channel.leave() } catch (_err) {}
    }
    if (this.socket) {
      try { this.socket.disconnect() } catch (_err) {}
    }
    this.channel = null
    this.socket = null
    this.starting = false
    this.closePeers()
    this.live = false
    if (this.button) this.setState("idle", "Call")
  },

  closePeers() {
    if (this.stream) this.stream.getTracks().forEach((track) => track.stop())
    this.stream = null
    if (this.up) this.up.close()
    if (this.down) this.down.close()
    this.up = null
    this.down = null
    const audio = document.getElementById("remote-audio")
    if (audio) audio.remove()
  },

  fail(reason) {
    console.error("voice", reason)
    this.hangup()
    this.setState("failed", "Call failed")
    const message = String(reason || "The call did not connect")
    this.button.title = message
    this.note(message)
  },

  setState(state, label) {
    this.button.dataset.state = state
    this.button.textContent = label
    this.button.setAttribute("aria-pressed", state === "live" ? "true" : "false")
    if (state !== "failed") {
      this.button.removeAttribute("title")
      this.note("")
    }
  },

  note(text) {
    const note = document.getElementById("call-note")
    if (note) note.textContent = text || ""
  }
}
