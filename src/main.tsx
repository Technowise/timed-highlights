Devvit.configure({redditAPI: true, 
                  redis: true,
                  userActions: false });

import { Devvit, SettingScope, TriggerContext} from '@devvit/public-api';
type positionRange = 1|2|3|4;

type timedHighlight = {
  postId: string,
  expireTime: number
}

Devvit.addTrigger({
  event: 'PostDelete',
  onEvent: async (event, context) => {
    const {redis} = context;
    console.log(`Received PostDelete event for post: \n${event.postId}`);
    var postHash = await context.redis.hGet('timedHighlights',event.postId);
    if( postHash && postHash.length > 0 ) { //Delete respective hash if it exists for the deleted post.
      context.redis.hDel('timedHighlights', [event.postId]);
      console.log("Deleted hash of deleted post id "+event.postId );
    }
  },
});

Devvit.addTrigger({
  event:'AppInstall',
  onEvent: async (event, context) => {
    await addHighlightsScheduledJob(context);
  },
});

Devvit.addTrigger({
  event:'AppUpgrade',
  onEvent: async (event, context) => {
    await addHighlightsScheduledJob(context);
  },
});

async function addHighlightsScheduledJob(context:TriggerContext) {  
  const oldJobId = (await context.redis.get('removeHighlightsJobId')) || '0';
  const scheduledJobs = await context.scheduler.listJobs();

  for( const key in scheduledJobs ){
    if ( scheduledJobs[key].id == oldJobId) {
      await context.scheduler.cancelJob(oldJobId);
    }
  }
  console.log("Adding a new scheduled job for removing expired highlights.");
  const jobId = await context.scheduler.runJob({
  name: 'remove-expired-highlights',
  cron: '0 * * * *', //Runs every hour once.
  });
  await context.redis.set('removeHighlightsJobId', jobId);
}

Devvit.addSettings([
    {
    type: 'number',
    name: 'defaultNumberOfDays',
    label: 'Default number of days for highlights:',
    scope: SettingScope.Installation,
    defaultValue: 1,
    onValidate: (event) => {
      if (event.value! > 365) {
        return 'Number too high! Must be lower than 365.';
      }
      if (event.value! < 1) {
        return 'Number too low! Must be at least 1.';
      }
    }
  },
  {
    type: 'boolean',
    name: 'addInformationalComment',
    label: 'Add informational comment on the highlight time-period to the post:',
    scope: SettingScope.Installation, 
    defaultValue: true
  },

  {
    type: 'boolean',
    name: 'notifyModeratorsOnHighlightRemoval',
    label: 'Notify moderators on highlight removal through mod-mail:',
    scope: SettingScope.Installation, 
    defaultValue: true
  },
]);

Devvit.addSchedulerJob({
  name: 'remove-expired-highlights',  
  onRun: async(event, context) => {
    console.log("Starting the Timed-Highlights scheduled cron job...");
    let dateNow = new Date();
    var presentTimedHighlightsHashes = await context.redis.hGetAll('timedHighlights');
    
    if (presentTimedHighlightsHashes && Object.keys(presentTimedHighlightsHashes).length > 0) {
      for (const key in presentTimedHighlightsHashes) {
        const HLObj:timedHighlight = JSON.parse(presentTimedHighlightsHashes[key]);
        if( dateNow.getTime() > HLObj.expireTime ) {
          console.log("Expired highlight post: ");
          console.log(HLObj);
    
          try {
            const post = await context.reddit.getPostById(HLObj.postId);
            const notifyModeratorsOnHighlightRemoval = await context.settings.get('notifyModeratorsOnHighlightRemoval');
            if( post.isStickied() ) {
              await post.unsticky();
              console.log("Unstickied post: "+HLObj.postId);
              if( notifyModeratorsOnHighlightRemoval) {
                const conversationId = await context.reddit.modMail.createModNotification({  
                  subject: 'Timed-Highlights post removal',
                  bodyMarkdown: 'A post has been removed from Timed-Highlights as time period for highlight has elapsed. \n\n Post title: '+post.title+'\n\n Post link: '+post.permalink+'\n\n Removal time: '+ dateNow.toISOString() ,
                  subredditId: context.subredditId,
                });
              }
            }

            var removedItemsCount = await context.redis.hDel('timedHighlights', [HLObj.postId]);
            if( removedItemsCount > 0 ) {
              console.log("removed "+HLObj.postId+" from redis");
            }
          }
          catch(err) {
            console.log("There was an error unstickying the post. "+ (err as Error).message);
          }
        }
      }
    }
    console.log("Timed-Highlights scheduled cron job ended.");
  },
});

const highlightsInputForm = Devvit.createForm( (data) => {
  return   {
    title: 'Add to Timed Highlights 📅 📌',
    fields: [
      {
        type: 'number',
        name: 'days',
        label: 'Number of days',
        defaultValue: data.defaultNumberOfDays,
        required: true,
        helpText: "Number of days to keep in highlights.",
      },
      {
        type: 'select',
        name: 'position',
        label: 'Position',
        options: [{'label': '1', value: '1'},
                  {'label': '2', value: '2'},
                  //Presently 3 and 3 options are not working with post.sticky method. Need to contact reddit support on this.
                  //{'label': '3', value: '3'},
                  //{'label': '4', value: '4'}
                ],
        helpText: "Position in highlights.",
        defaultValue: ['1'],
        required: true,
      }
    ],
    acceptLabel: 'Submit',
  };
  },
    async(event, context) => {
    if( event.values.days > 365  || event.values.days < 1 ) { //Validate input for days.
      context.ui.showToast({
        text: `Please enter a value between 1 and 365 for days. Submission failed.`,
        appearance: 'neutral',
      });
      return;
    }

    var givenPosition = '1';
    if( event.values.position ) {
      givenPosition = event.values.position[0];
    }
    
    var pos:positionRange;
    switch (givenPosition) {
      case '1':
        pos = 1;
        break;
      case '2':
        pos = 2;
        break;
        /*
       case '3':
        pos = 3;
        break;
      case '4':
        pos = 4;
        break;
        */
      default:
        pos = 1;
        break;   
    }

    await createOrUpdateHighlight ( context, event.values.days, pos)
  }
);

async function createOrUpdateHighlight(context:Devvit.Context, days:number, position:positionRange) {
  var postId = context.postId ?? 'defaultPostId';
  var succeeded = true;

  if ( postId != 'defaultPostId' ) {
    const post = await context.reddit.getPostById(postId);
    try {
      await post.sticky(position);
    }
    catch(err) {
      console.log("There was an error stickying the post. "+ (err as Error).message);
      succeeded = false;
    }
  }
  
  let dateNow = new Date();
  let daysOffsetMs = 86400000 * days;
  let expireDate = new Date( dateNow.getTime() + daysOffsetMs);

  if( succeeded ) {
    const newHL:timedHighlight = {postId: postId, expireTime:expireDate.getTime() };
    await context.redis.hSet('timedHighlights', { [postId]: JSON.stringify(newHL) });

    context.ui.showToast(
      `Post has been highlighted/sticked for ${days} days.`
    );

    const addInformationalComment = await context.settings.get('addInformationalComment');

    if( addInformationalComment ) {
      const currentUsrname = await context.reddit.getCurrentUsername();
      const metaComment = await context.reddit.submitComment({
        id: `${postId}`,
        text: 'This post has been added to Timed Highlights from '+dateNow.toISOString()+' to '+ expireDate.toISOString()+' by '+currentUsrname+'\n\n **Timed Highlights app** ( https://developers.reddit.com/apps/timed-highlights ) '
      });
    }

    const subreddit = await context.reddit.getCurrentSubreddit();
    context.ui.navigateTo(subreddit);
  } 
  else {
      context.ui.showToast(
      `Encountered an error while adding the post to highlights. Please contact /u/technowise with details for support.`
    );
  }
}

Devvit.addMenuItem({
  location: 'post',
  label: 'Add to Timed Highlights 📅 📌',
  onPress: async(event, context) => {
    const defaultNumberOfDays = await context.settings.get('defaultNumberOfDays') ?? 1;
    context.ui.showForm(highlightsInputForm, {defaultNumberOfDays: defaultNumberOfDays});
  },
  forUserType: 'moderator'
});

export default Devvit;
