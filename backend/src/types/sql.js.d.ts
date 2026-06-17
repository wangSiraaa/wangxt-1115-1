declare module 'sql.js' {
  export interface Database {
    run(sql: string, params?: any[]): void;
    prepare(sql: string): Statement;
    exec(sql: string): any[];
    export(): Uint8Array;
    close(): void;
  }

  export interface Statement {
    bind(params?: any[]): boolean;
    step(): boolean;
    get(params?: any[]): any[];
    getAsObject(params?: any[]): Record<string, any>;
    getColumnNames(): string[];
    free(): boolean;
    reset(): void;
  }

  interface SqlJsStatic {
    Database: new (data?: ArrayLike<number> | Buffer | null) => Database;
  }

  interface InitSqlJsOptions {
    locateFile?: (file: string) => string;
  }

  function initSqlJs(options?: InitSqlJsOptions): Promise<SqlJsStatic>;
  export default initSqlJs;
}
