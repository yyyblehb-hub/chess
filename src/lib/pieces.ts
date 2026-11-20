import type { Color, PieceType } from './chess';

// chess.com classic set, see src/assets/pieces/CREDITS.txt. Every file is a
// 150x150 PNG on the same baseline and each is under Vite's inline limit, so
// the board still loads with zero piece requests.
import wb from '../assets/pieces/wb.png';
import wk from '../assets/pieces/wk.png';
import wn from '../assets/pieces/wn.png';
import wp from '../assets/pieces/wp.png';
import wq from '../assets/pieces/wq.png';
import wr from '../assets/pieces/wr.png';
import bb from '../assets/pieces/bb.png';
import bk from '../assets/pieces/bk.png';
import bn from '../assets/pieces/bn.png';
import bp from '../assets/pieces/bp.png';
import bq from '../assets/pieces/bq.png';
import br from '../assets/pieces/br.png';

const PIECES: Record<string, string> = { wb, wk, wn, wp, wq, wr, bb, bk, bn, bp, bq, br };

export const pieceImage = (color: Color, type: PieceType) => PIECES[`${color}${type}`];
