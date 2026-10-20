export function winningCells(board,row,column){
  const player=board[row][column];if(player===null)return [];
  for(const [dr,dc] of [[0,1],[1,0],[1,1],[1,-1]]){
    const cells=[[row,column]];
    for(const sign of [-1,1])for(let step=1;step<4;step++){
      const r=row+dr*step*sign,c=column+dc*step*sign;
      if(r<0||r>=6||c<0||c>=7||board[r][c]!==player)break;
      cells.push([r,c]);
    }
    if(cells.length>=4)return cells;
  }
  return [];
}
export function dropDisc(room,column){
  if(!Number.isInteger(column)||column<0||column>6)throw Object.assign(new Error('Scegli una colonna da 1 a 7.'),{status:400});
  let row=5;while(row>=0&&room.board[row][column]!==null)row--;
  if(row<0)throw Object.assign(new Error('Questa colonna è piena. Scegline un’altra.'),{status:409});
  const player=room.turn;room.board[row][column]=player;room.lastMove={row,column,player};
  room.winningCells=winningCells(room.board,row,column);
  if(room.winningCells.length){room.status='finished';room.winner=player;}
  else if(room.board[0].every(cell=>cell!==null)){room.status='finished';room.winner=null;}
  else room.turn=1-player;
}
