import type { Position } from "../types.js";
export type NotifyFn = (chatId: string, message: string) => Promise<void>;
export declare function startWatcher(position: Position, notify: NotifyFn): void;
export declare function stopWatcher(positionId: string): void;
export declare function getActiveWatcherCount(): number;
/** Watchers running for positions owned by this chat (same DB as global restore). */
export declare function getActiveWatcherCountForChat(chatId: string): number;
export declare function restoreWatchers(notify: NotifyFn): Promise<void>;
//# sourceMappingURL=manager.d.ts.map