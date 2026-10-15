defmodule Battleship.Game do
  @moduledoc false

  use GenServer

  @topic "game:demo"

  def start_link(_opts) do
    GenServer.start_link(__MODULE__, %{}, name: __MODULE__)
  end

  def player_shot(raw), do: GenServer.call(__MODULE__, {:player_shot, raw})
  def opponent_shot, do: GenServer.call(__MODULE__, :opponent_shot)
  def snapshot, do: GenServer.call(__MODULE__, :snapshot)
  def reset, do: GenServer.call(__MODULE__, :reset)

  @impl true
  def init(_opts) do
    {:ok, Battleship.Match.new()}
  end

  @impl true
  def handle_call({:player_shot, raw}, _from, match) do
    {match, reply} = Battleship.Match.player_shot(match, raw)
    broadcast_shot(reply)
    {:reply, reply, match}
  end

  def handle_call(:opponent_shot, _from, match) do
    {match, reply} = Battleship.Match.opponent_shot(match)
    broadcast_shot(reply)
    {:reply, reply, match}
  end

  def handle_call(:snapshot, _from, match) do
    {:reply, Battleship.Match.view(match), match}
  end

  def handle_call(:reset, _from, _match) do
    match = Battleship.Match.new()
    Phoenix.PubSub.broadcast(Battleship.PubSub, @topic, {:reset, Battleship.Match.view(match)})
    {:reply, Battleship.Match.view(match), match}
  end

  defp broadcast_shot(%{"accepted" => "yes", "board" => side} = reply) do
    Phoenix.PubSub.broadcast(Battleship.PubSub, @topic, {
      :shot,
      %{
        "side" => side,
        "coordinate" => reply["coordinate"],
        "result" => reply["result"],
        "ship" => reply["ship"],
        "sunk" => reply["sunk"],
        "spoken" => reply["spoken"]
      }
    })
  end

  defp broadcast_shot(_reply), do: :ok
end
