Visitor can enter a game by:

(INITIATOR): clicking Find Game button when at least one other user is already listed as "ready" 
* Finds an opponent instantly, never appears in list as "ready"
* Confirms opponent match by finding a user directly by ID
* Associates with game by creating a ‘game-sessions’ table with INITIATOR’s and RESPONDENT’s IDs
* Waits for RESPONDENT to find the table while polling

(RESPONDENT): being a listed "ready" user who is found by an INITIATOR
* Waits in lobby with status "ready”
* Confirms opponent match by finding a game session with RESPONDENT’S ID in it
* Associates with game by polling 'game-sessions' list for a session with RESPONDENT’s ID in it
* If found, changes status to “confirming” and is found by INITIATOR


1. Visitor clicks Enter Lobby
2. Lobby screen is revealed
3. Visitor handshakes with chosen name and default status "lobby"
4. Establishes visitorID and local storage if no local storage found
5. Begins to handshake and poll regularly for users and chat messages
* never stops handshaking
* stops polling users and chat when status not "lobby" or "ready"

* In lobby,  Visitor clicks Find Game button
* Checks user list for users with "ready" status…

If a ready user is NOT found by Visitor on first poll:

Visitor is a RESPONDENT

 Changes status to "ready"
 Appears in user list as "ready", to be found by an INITIATOR

If a ready user IS found by Visitor on first poll;

Visitor is an INITIATOR

Create new game session

  Inserts a new 'game-sessions' table in DB
  sets visitorIDs of both players
  sets a random die roll as the first' die
  sets which player has a turn first, randomly
  gets the unique gameID just created for the table
  gets the 'at bat' die
  gets the first player to have a turn

Change own status and display popup

 Reveals 'opponent found' popup with Start Game button disabled
 Changes status to "confirming"
 Begins polling for RESPONDENT status "confirming"
