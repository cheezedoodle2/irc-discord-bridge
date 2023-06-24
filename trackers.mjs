// This is from this repository: https://github.com/newhouse/url-tracking-stripper
// Owned by https://github.com/newhouse

export default class TrackerRemover {
  // More detailed string pattern suffixes, stored by their common root.
  static TRACKERS_BY_ROOT = {

    // Google's Urchin Tracking Module
    'utm_': [
      'source',
      'medium',
      'term',
      'campaign',
      'content',
      'name',
      'cid',
      'reader',
      'viz_id',
      'pubreferrer',
      'swu'
    ],

    // Adobe Omniture SiteCatalyst
    'IC': [
      'ID'
    ],

    // Adobe Omniture SiteCatalyst
    'ic': [
      'id'
    ],

    // Hubspot
    '_hs': [
      'enc',
      'mi'
    ],

    // Marketo
    'mkt_': [
      'tok'
    ],

    // MailChimp
    // https://developer.mailchimp.com/documentation/mailchimp/guides/getting-started-with-ecommerce/
    'mc_': [
      'cid',
      'eid'
    ],

    // comScore Digital Analytix?
    // http://www.about-digitalanalytics.com/comscore-digital-analytix-url-campaign-generator
    'ns_': [
      'source',
      'mchannel',
      'campaign',
      'linkname',
      'fee'
    ],

    // Simple Reach
    'sr_': [
      'share'
    ],

    // Vero
    'vero_': [
      'conv',
      'id'
    ],

    // Non-prefixy and 1-offs
    '': [
      // Facebook Click Identifier
      // http://thisinterestsme.com/facebook-fbclid-parameter/
      'fbclid',
      // Instagram Share Identifier
      'igshid',
      'srcid',
      // Google Click Identifier
      'gclid',
      // Some other Google Click thing
      'ocid',
      // Unknown
      'ncid',
      // Unknown
      'nr_email_referer',
      // Generic-ish. Facebook, Product Hunt and others
      'ref',
      // Alibaba-family 'super position model' tracker:
      // https://github.com/newhouse/url-tracking-stripper/issues/38
      'spm'
    ]
  };

  static TRACKERS_BY_ROOT = {
    "tracker": [
      "suffix1",
      "suffix2"
    ]
  }

  static ALL_TRACKERS = Object.keys(TrackerRemover.TRACKERS_BY_ROOT).reduce((trackers, root) => {
    TrackerRemover.TRACKERS_BY_ROOT[root].forEach(suffix => trackers.push(root + suffix));
    return trackers;
  }, []);

  static TRACKER_REGEXES_BY_TRACKER = TrackerRemover.ALL_TRACKERS.reduce((memo, tracker) => {
    memo[tracker] = new RegExp("((^|&)" + tracker + "=[^&#]*)", "ig");
    return memo;
  }, {});

  // Actually strip out the tracking codes/parameters from a URL and return the cleansed URL
  static removeTrackersFromUrl(url) {
    if (!url) return url;

    const urlPieces = url.split('?');

    // If no params, nothing to modify
    if (urlPieces.length === 1) {
      return url;
    }

    TrackerRemover.ALL_TRACKERS.forEach(tracker => {
      urlPieces[1] = urlPieces[1].replace(TrackerRemover.TRACKER_REGEXES_BY_TRACKER[tracker], '');
    });

    // If we've collapsed the URL to the point where there's an '&' against the '?'
    // then we need to get rid of that.
    while (urlPieces[1].charAt(0) === '&') {
      urlPieces[1] = urlPieces[1].substr(1);
    }

    return urlPieces[1] ? urlPieces.join('?') : urlPieces[0];
  }
}