defmodule BattleshipWeb.BoardLive do
  use BattleshipWeb, :live_view

  @topic "game:demo"

  @impl true
  def mount(_params, _session, socket) do
    socket =
      socket
      |> assign(:page_title, "Battleship")
      |> assign(:last_spoken, "Both fleets are on the board. Call a square.")
      |> assign(:conceal_admiral, true)
      |> assign(:log, [])

    if connected?(socket) do
      Phoenix.PubSub.subscribe(Battleship.PubSub, @topic)
    end

    {:ok, socket}
  end

  @impl true
  def handle_event("board_ready", _params, socket) do
    view = Battleship.Game.snapshot()

    {:noreply,
     socket
     |> assign(:log, view["shots"])
     |> push_event("setup", view)
     |> push_event("fleet", %{conceal: socket.assigns.conceal_admiral})}
  end

  def handle_event("new_match", _params, socket) do
    view = Battleship.Game.reset()

    {:noreply,
     socket
     |> assign(:last_spoken, "New match. Both fleets are on the board.")
     |> assign(:conceal_admiral, true)
     |> assign(:log, [])
     |> push_event("setup", view)
     |> push_event("fleet", %{conceal: true})}
  end

  def handle_event("toggle_admiral", _params, socket) do
    conceal = not socket.assigns.conceal_admiral

    {:noreply,
     socket
     |> assign(:conceal_admiral, conceal)
     |> push_event("fleet", %{conceal: conceal})}
  end

  @impl true
  def handle_info({:shot, entry}, socket) do
    {:noreply,
     socket
     |> assign(:last_spoken, entry["spoken"])
     |> update(:log, fn log -> log ++ [entry] end)
     |> push_event("shot", entry)}
  end

  def handle_info({:reset, view}, socket) do
    {:noreply,
     socket
     |> assign(:log, [])
     |> push_event("setup", view)
     |> push_event("clear_admiral", %{})}
  end

  @impl true
  def render(assigns) do
    ~H"""
    <div id="battleship">
      <header>
        <div class="brand">
          <h1>Battleship</h1>
          <p>Downbeat</p>
        </div>
        <div class="actions">
          <div id="voice" phx-hook="Voice" phx-update="ignore">
            <button id="call" type="button">Call</button>
          </div>
          <button
            id="admiral-fleet"
            type="button"
            phx-click="toggle_admiral"
            aria-pressed={to_string(@conceal_admiral)}
          >
            {if @conceal_admiral, do: "Show fleet", else: "Hide fleet"}
          </button>
          <button id="new-match" type="button" phx-click="new_match">New match</button>
          <p id="call-note" role="status"></p>
        </div>
        <p id="last-spoken" role="status">{@last_spoken}</p>
      </header>

      <div class="stage">
        <div id="board" phx-hook="Board" phx-update="ignore"></div>
        <aside>
          <section id="admiral" phx-hook="Chat" phx-update="ignore">
            <h2>Admiral</h2>
            <ol id="admiral-log" aria-label="Conversation"></ol>
            <form id="admiral-form">
              <label for="admiral-input">Square</label>
              <input
                id="admiral-input"
                type="text"
                placeholder="B seven"
                autocomplete="off"
                enterkeyhint="send"
                autofocus
                disabled
              />
              <button id="admiral-send" type="submit" disabled>Send</button>
            </form>
            <p id="admiral-status" role="status"></p>
          </section>
          <section class="shots">
            <h2>Shots</h2>
            <ol id="shot-log" phx-hook="ShotLog">
              <li :if={@log == []} class="empty">No shots yet.</li>
              <li
                :for={entry <- @log}
                data-side={entry["side"]}
                data-result={shot_result(entry)}
              >
                <span class="who">{shot_who(entry)}</span>
                <span class="coord">{entry["coordinate"]}</span>
                <span class="outcome">{shot_outcome(entry)}</span>
              </li>
            </ol>
          </section>
        </aside>
      </div>
    </div>
    """
  end

  defp shot_who(%{"side" => "yours"}), do: "Admiral"
  defp shot_who(%{"side" => "theirs"}), do: "You"
  defp shot_who(_entry), do: "Shot"

  defp shot_result(%{"sunk" => "yes"}), do: "sunk"
  defp shot_result(%{"result" => result}) when is_binary(result), do: result
  defp shot_result(_entry), do: "miss"

  defp shot_outcome(entry) do
    case shot_result(entry) do
      "sunk" -> "Sunk"
      "hit" -> "Hit"
      "miss" -> "Miss"
      other -> other
    end
  end
end
