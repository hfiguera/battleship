import {Socket} from "phoenix"

// Typed turns on Maestro's voice socket. No microphone: join, start a text
// session, and send each line with send_text. The board still moves because
// the agent calls the same shot API.
export default {
  mounted() {
    this.log = this.el.querySelector("#admiral-log")
    this.form = this.el.querySelector("#admiral-form")
    this.input = this.el.querySelector("#admiral-input")
    this.send = this.el.querySelector("#admiral-send")
    this.status = this.el.querySelector("#admiral-status")
    this.form.addEventListener("submit", (event) => {
      event.preventDefault()
      this.submit()
    })
    this.handleEvent("clear_admiral", () => this.fresh())
    this.connect()
  },

  fresh() {
    if (this.channel) this.channel.leave()
    if (this.socket) this.socket.disconnect()
    this.channel = null
    this.socket = null
    this.log.replaceChildren()
    this.input.value = ""
    this.input.disabled = true
    this.send.disabled = true
    this.connect()
  },

  destroyed() {
    if (this.channel) this.channel.leave()
    if (this.socket) this.socket.disconnect()
  },

  async connect() {
    this.setStatus("Connecting")
    let session
    try {
      const response = await fetch("/api/voice/session", {headers: {accept: "application/json"}})
      if (!response.ok) throw new Error("The admiral is unavailable")
      session = await response.json()
    } catch (err) {
      this.setStatus(err.message)
      return
    }

    const socket = new Socket(session.socket_url, {params: {token: session.token}})
    socket.connect()
    this.socket = socket

    const channel = socket.channel(`voice_sandbox:${crypto.randomUUID()}`, {
      agent_uuid: session.agent_uuid
    })
    this.channel = channel

    channel.on("agent_response", ({text}) => {
      const line = this.caption(text)
      if (line) this.add("admiral", line)
      this.setStatus("")
      this.ready()
    })
    channel.on("call_error", ({reason}) => this.setStatus(reason || "The admiral dropped the line"))

    channel
      .join()
      .receive("ok", () => {
        channel.push("start_text_session", {}).receive("error", ({reason}) => {
          this.setStatus(reason || "Could not start the conversation")
        })
      })
      .receive("error", ({reason}) => this.setStatus(reason || "Could not reach the admiral"))
  },

  submit() {
    const text = this.input.value.trim()
    if (!text || !this.channel) return
    this.input.value = ""
    this.add("you", text)
    this.input.disabled = true
    this.send.disabled = true
    this.channel.push("send_text", {text}, 15000).receive("error", ({reason}) => {
      this.setStatus(reason || "That line did not go through")
      this.ready()
    })
  },

  caption(text) {
    return String(text || "")
      .replace(/\[[^\]]*\]\s*/g, "")
      .replace(/[ \t]{2,}/g, " ")
      .trim()
  },

  add(role, text) {
    const item = document.createElement("li")
    item.dataset.role = role
    const who = document.createElement("span")
    who.className = "who"
    who.textContent = role === "you" ? "You" : "Admiral"
    const line = document.createElement("p")
    line.textContent = text
    item.append(who, line)
    this.log.appendChild(item)
    this.log.scrollTop = this.log.scrollHeight
  },

  ready() {
    this.input.disabled = false
    this.send.disabled = false
    this.input.focus()
  },

  setStatus(text) {
    this.status.textContent = text
    const failed = /unavailable|dropped|could not|did not|failed/i.test(text || "")
    this.status.dataset.tone = text && failed ? "error" : ""
  }
}
