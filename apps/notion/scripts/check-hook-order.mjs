import ts from 'typescript';
import fs from 'node:fs';
const path='src/main.tsx';
const source=ts.createSourceFile(path,fs.readFileSync(path,'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const failures=[];
function contains(node,predicate){if(ts.isFunctionLike(node))return false;if(predicate(node))return true;let found=false;ts.forEachChild(node,child=>{if(ts.isFunctionLike(child))return;found ||= contains(child,predicate);});return found;}
function visit(node){
 if(ts.isFunctionDeclaration(node)&&node.body&&/^[A-Z]/.test(node.name?.text||'')){
  let returned=false;
  for(const statement of node.body.statements){
   if(returned&&contains(statement,n=>ts.isCallExpression(n)&&ts.isIdentifier(n.expression)&&/^use[A-Z]/.test(n.expression.text))){const pos=source.getLineAndCharacterOfPosition(statement.getStart());failures.push(`${path}:${pos.line+1}: ${node.name.text}: hook after an early return`);}
   returned ||= contains(statement,n=>ts.isReturnStatement(n));
  }
 }
 ts.forEachChild(node,visit);
}
visit(source);
if(failures.length){console.error(failures.join('\n'));process.exit(1);}
console.log('Component early-return hook order check passed (focused guard, not a full hooks linter).');
