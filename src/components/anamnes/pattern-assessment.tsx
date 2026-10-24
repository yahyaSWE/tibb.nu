import { questionById } from '@/lib/anamnes/questions';
import type { PatternFinding } from '@/lib/anamnes/types';

export function PatternAssessment({finding}:{finding:PatternFinding}) {
  const assessment=finding.assessment;if(!assessment)return null;
  return <div><p>{assessment.assessedCriteria} av {assessment.totalCriteria} kriterier har ett känt svar. Intern prioritet: {assessment.normalizedSupport.toFixed(2)}. Värdet är ingen sannolikhet.</p>
    <p>Stödvikt {assessment.supportWeight.toFixed(1)} · motfyndsvikt {assessment.oppositionWeight.toFixed(1)}. Godkännandekraven är oförändrade.</p>
    <ul>{assessment.components.map(component=><li key={component.id}>{component.label}: {component.state==='supported'?'stöd i modellens kriterier':component.state==='opposed'?'motsägs av kärnfynd':'inte klarlagt'}</li>)}</ul>
    {assessment.missingCoreQuestionIds.length>0&&<><h4>Saknade eller okända kärnfynd</h4><ul>{assessment.missingCoreQuestionIds.map(id=><li key={id}>{questionById.get(id)?.prompt}</li>)}</ul></>}
    {assessment.contradictedCoreQuestionIds.length>0&&<><h4>Kärnfynd som motsägs</h4><ul>{assessment.contradictedCoreQuestionIds.map(id=><li key={id}>{questionById.get(id)?.prompt}</li>)}</ul></>}
  </div>;
}
