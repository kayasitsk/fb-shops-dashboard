import React from 'react'
export function Tabs({value,onChange,children}){return <div>{React.Children.map(children,child=>React.cloneElement(child,{value,onChange}))}</div>}
export function TabsList({value,onChange,children}){const triggers = React.Children.toArray(children).filter(c=>c.type.name==='TabsTrigger');return <div className='tabs'>{triggers.map(tr => React.cloneElement(tr,{value,onChange}))}</div>}
export function TabsTrigger({value:val,value:current,onChange,children}){const active = current===val;return <button className={`tab ${active?'active':''}`} onClick={()=>onChange?.(val)}>{children}</button>}
export function TabsContent({when,value,children}){return value===when ? <div>{children}</div> : null}