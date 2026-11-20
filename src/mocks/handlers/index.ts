import { bookHandlers } from './books'
import { castleHandlers } from './castle'
import { decorHandlers } from './decor'
import { characterHandlers } from './characters'
import { exploreHandlers } from './explore'
import { graphHandlers } from './graph'
import { memoHandlers } from './memos'
import { quizHandlers } from './quizzes'
import { userHandlers } from './users'

export const handlers = [...bookHandlers, ...graphHandlers, ...memoHandlers, ...quizHandlers, ...characterHandlers, ...exploreHandlers, ...userHandlers, ...castleHandlers, ...decorHandlers]
